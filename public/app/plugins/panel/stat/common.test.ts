import {
  createDataFrame,
  FieldType,
  PanelOptionsEditorBuilder,
  ReducerID,
  standardEditorsRegistry,
} from '@grafana/data';
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
    expect(paths).toEqual(
      expect.arrayContaining([
        'reduceOptions.values',
        'reduceOptions.limit',
        'reduceOptions.calcs',
        'reduceOptions.fields',
      ])
    );
  });

  it('omits the field matcher option when includeFieldMatcher is false', () => {
    const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
    addStandardDataReduceOptions(builder, false);

    expect(getItem(builder, 'reduceOptions.fields')).toBeUndefined();
    expect(getItem(builder, 'reduceOptions.values')).toBeDefined();
  });

  it('defaults calculation to lastNotNull', () => {
    const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
    addStandardDataReduceOptions(builder);

    expect(getItem(builder, 'reduceOptions.calcs')?.defaultValue).toEqual([ReducerID.lastNotNull]);
  });

  it('only shows the limit input when displaying all values', () => {
    const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
    addStandardDataReduceOptions(builder);

    const showIf = getItem(builder, 'reduceOptions.limit')?.showIf!;
    expect(showIf({ reduceOptions: { values: true } } as SingleStatBaseOptions, undefined)).toBe(true);
    expect(showIf({ reduceOptions: { values: false } } as SingleStatBaseOptions, undefined)).toBe(false);
  });

  it('only shows the calculation picker when calculating a single value', () => {
    const builder = new PanelOptionsEditorBuilder<SingleStatBaseOptions>();
    addStandardDataReduceOptions(builder);

    const showIf = getItem(builder, 'reduceOptions.calcs')?.showIf!;
    expect(showIf({ reduceOptions: { values: false } } as SingleStatBaseOptions, undefined)).toBe(true);
    expect(showIf({ reduceOptions: { values: true } } as SingleStatBaseOptions, undefined)).toBe(false);
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
