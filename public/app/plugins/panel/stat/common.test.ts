import { createDataFrame, FieldType, PanelOptionsEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { type SingleStatBaseOptions, VizOrientation } from '@grafana/schema';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { addOrientationOption, addStandardDataReduceOptions } from './common';

// The calcs custom editor resolves `standardEditorsRegistry.get('stats-picker')` at build time,
// so the registry has to be initialized before addStandardDataReduceOptions runs.
standardEditorsRegistry.setInit(getAllOptionEditors);

function getItem(builder: PanelOptionsEditorBuilder<SingleStatBaseOptions>, path: string) {
  return builder.getItems().find((item) => item.path === path);
}

describe('addStandardDataReduceOptions', () => {
  it('registers value, limit, calculation and fields options by default', () => {
    const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
    addStandardDataReduceOptions(builder);

    const paths = builder.getItems().map((item) => item.path);
    expect(paths).toMatchSnapshot();
  });

  it('omits the field matcher option when includeFieldMatcher is false', () => {
    const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
    addStandardDataReduceOptions(builder, false);

    expect(getItem(builder, 'reduceOptions.fields')).toBeUndefined();
    expect(getItem(builder, 'reduceOptions.values')).toBeDefined();
  });

  // The limit input and the calculation picker are mutually exclusive: limit shows for "all values"
  // (values: true), the calc picker shows when reducing to a single value (values: false).
  describe.each([
    { reduceOptions: { values: true }, showsLimit: true, showsCalcs: false },
    { reduceOptions: { values: false }, showsLimit: false, showsCalcs: true },
  ])('showIf gating for reduceOptions $reduceOptions', ({ reduceOptions, showsLimit, showsCalcs }) => {
    const config = { reduceOptions } as SingleStatBaseOptions;

    it(`${showsLimit ? 'shows' : 'hides'} the limit input`, () => {
      const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
      addStandardDataReduceOptions(builder);

      const showIf = getItem(builder, 'reduceOptions.limit')?.showIf!;
      expect(showIf(config, undefined)).toBe(showsLimit);
    });

    it(`${showsCalcs ? 'shows' : 'hides'} the calculation picker`, () => {
      const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
      addStandardDataReduceOptions(builder);

      const showIf = getItem(builder, 'reduceOptions.calcs')?.showIf!;
      expect(showIf(config, undefined)).toBe(showsCalcs);
    });
  });

  describe('fields getOptions', () => {
    function getFieldsOptions(builder: PanelOptionsEditorBuilder<SingleStatBaseOptions>) {
      // getOptions lives on the select editor settings.
      const settings = getItem(builder, 'reduceOptions.fields')?.settings as {
        getOptions: (context: { data?: unknown }) => Promise<Array<{ value: string; label: string }>>;
      };
      return settings.getOptions;
    }

    it('always returns the numeric and all-fields entries', async () => {
      const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
      addStandardDataReduceOptions(builder);

      const options = await getFieldsOptions(builder)({ data: undefined });
      expect(options).toEqual([
        { value: '', label: 'Numeric Fields' },
        { value: '/.*/', label: 'All Fields' },
      ]);
    });

    it('appends an anchored regex entry for each field in the data', async () => {
      const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
      addStandardDataReduceOptions(builder);

      const frame = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1] },
          { name: 'cpu.usage', type: FieldType.number, values: [10] },
        ],
      });

      const options = await getFieldsOptions(builder)({ data: [frame] });
      // regex special chars in the field name are escaped
      expect(options).toEqual(
        expect.arrayContaining([
          { value: '/^time$/', label: 'time' },
          { value: '/^cpu\\.usage$/', label: 'cpu.usage' },
        ])
      );
    });
  });
});

describe('addOrientationOption', () => {
  it('registers the orientation radio defaulting to Auto', () => {
    const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
    addOrientationOption(builder);

    const item = getItem(builder, 'orientation');
    expect(item).toBeDefined();
    expect(item?.defaultValue).toBe(VizOrientation.Auto);
  });

  it('exposes auto, horizontal and vertical choices', () => {
    const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
    addOrientationOption(builder);

    const settings = getItem(builder, 'orientation')?.settings as {
      options: Array<{ value: VizOrientation }>;
    };
    expect(settings.options.map((o) => o.value)).toEqual([
      VizOrientation.Auto,
      VizOrientation.Horizontal,
      VizOrientation.Vertical,
    ]);
  });
});
