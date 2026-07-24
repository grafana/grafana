import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import {
  createDataFrame,
  type Field,
  FieldMatcherID,
  FieldNamePickerBaseNameMode,
  type FieldNamePickerConfigSettings,
  FieldType,
  FrameMatcherID,
  type StandardEditorProps,
} from '@grafana/data';
import { FieldNamePicker } from '@grafana/ui/internal';

import { SeriesEditor } from './SeriesEditor';
import { type Options, type XYSeriesConfig, SeriesMapping } from './panelcfg.gen';

// FieldNamePicker is a Combobox-backed field selector; stubbing it with plain buttons
// keeps these tests focused on SeriesEditor without driving the Combobox internals. The
// props each picker receives are read back via `pickerSettings` (see below) — no module
// global is needed because the stub is a jest.fn whose calls are already recorded.
jest.mock('@grafana/ui/internal', () => {
  const actual = jest.requireActual('@grafana/ui/internal');
  return {
    ...actual,
    FieldNamePicker: jest.fn(
      ({ item, value, onChange }: StandardEditorProps<string, FieldNamePickerConfigSettings>) => (
        <>
          <button
            type="button"
            data-testid={`field-name-picker-${item.id}`}
            onClick={() => onChange(`${item.id}-field`)}
          >
            {item.name} ({value ?? 'empty'})
          </button>
          {/* The real picker passes `undefined` (not null) when a selection is cleared. */}
          <button type="button" data-testid={`field-name-picker-${item.id}-clear`} onClick={() => onChange(undefined)}>
            clear {item.name}
          </button>
        </>
      )
    ),
  };
});

const fieldNamePickerMock = jest.mocked(FieldNamePicker);

/**
 * The `filter`/`baseNameMode` settings SeriesEditor builds for a dimension's picker,
 * read from the most recent render. Typed via jest.mocked, so no manual casting.
 */
function pickerSettings(dim: 'x' | 'y' | 'size' | 'color'): FieldNamePickerConfigSettings {
  const call = fieldNamePickerMock.mock.calls.filter(([props]) => props.item.id === dim).at(-1);
  if (call == null) {
    throw new Error(`FieldNamePicker was never rendered for the "${dim}" dimension`);
  }
  const settings = call[0].item.settings;
  if (settings == null) {
    throw new Error(`expected settings for the "${dim}" picker`);
  }
  return settings;
}

const defaultFrameMatcher = { frame: { matcher: { id: FrameMatcherID.byIndex, options: 0 } } };

function makeTestData() {
  return [
    createDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'ax', type: FieldType.number, values: [10, 20] },
        { name: 'ay', type: FieldType.number, values: [30, 40] },
      ],
    }),
    createDataFrame({
      name: 'B',
      fields: [
        { name: 'bx', type: FieldType.number, values: [1, 2] },
        { name: 'by', type: FieldType.number, values: [3, 4] },
      ],
    }),
  ];
}

/** Builds a standalone field for exercising the picker `filter` predicates. */
function makeField(type: FieldType, overrides: Partial<Field> = {}): Field {
  return { name: 'field', type, config: {}, values: [], ...overrides };
}

type SeriesEditorProps = StandardEditorProps<XYSeriesConfig[], unknown, Options>;

type EditorOverrides = Partial<SeriesEditorProps> & {
  contextOverrides?: Partial<SeriesEditorProps['context']>;
};

const minimalItem: SeriesEditorProps['item'] = {
  id: 'series-editor',
  name: 'Series',
};

function buildProps(onChange: SeriesEditorProps['onChange'], overrides: EditorOverrides = {}): SeriesEditorProps {
  const { value = [{ ...defaultFrameMatcher }], contextOverrides, ...rest } = overrides;

  return {
    value,
    onChange,
    item: minimalItem,
    context: {
      data: makeTestData(),
      options: { mapping: SeriesMapping.Auto } as Options,
      ...contextOverrides,
    },
    ...rest,
  };
}

/**
 * Renders SeriesEditor with a typed onChange spy and typed accessors for the config
 * arrays it emits, so tests never index-and-cast into `onChange.mock.calls`.
 */
function renderEditor(overrides: EditorOverrides = {}) {
  const onChange: jest.MockedFunction<SeriesEditorProps['onChange']> = jest.fn();
  const utils = render(<SeriesEditor {...buildProps(onChange, overrides)} />);

  return {
    ...utils,
    onChange,
    /** The config array passed to the Nth onChange call. */
    configAt: (call: number): XYSeriesConfig[] => {
      const config = onChange.mock.calls[call]?.[0];
      if (config == null) {
        throw new Error(`expected onChange call #${call} to have received a config`);
      }
      return config;
    },
    /** The config array from the most recent onChange call. */
    lastConfig: (): XYSeriesConfig[] => {
      const config = onChange.mock.calls.at(-1)?.[0];
      if (config == null) {
        throw new Error('expected onChange to have been called with a config');
      }
      return config;
    },
    /** Re-render with the same onChange spy, merging in new overrides. */
    rerenderEditor: (next: EditorOverrides = {}) => utils.rerender(<SeriesEditor {...buildProps(onChange, next)} />),
  };
}

describe('SeriesEditor', () => {
  beforeEach(() => {
    fieldNamePickerMock.mockClear();
  });

  describe('rendering', () => {
    it('renders frame and dimension fields in auto mapping mode', () => {
      renderEditor();

      expect(screen.getByText('Frame')).toBeVisible();
      expect(screen.getByText('X field')).toBeVisible();
      expect(screen.getByText('Y field')).toBeVisible();
      expect(screen.getByText('Size field')).toBeVisible();
      expect(screen.getByText('Color field')).toBeVisible();
    });

    it('shows the series list and add button in manual mapping', () => {
      renderEditor({ contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options } });

      expect(screen.getByRole('button', { name: /add series/i })).toBeVisible();
      expect(screen.getByTestId('layer-name-div')).toBeVisible();
      expect(screen.getByText('Series 1')).toBeVisible();
    });
  });

  describe('series management', () => {
    it('adds a series', async () => {
      const user = userEvent.setup();
      const { onChange, configAt } = renderEditor({
        value: [{ ...defaultFrameMatcher }],
        contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
      });

      await user.click(screen.getByRole('button', { name: /add series/i }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const next = configAt(0);
      expect(next).toHaveLength(2);
      expect(next[1]).toEqual(defaultFrameMatcher);
    });

    it('deletes a series', async () => {
      const user = userEvent.setup();
      const twoSeries: XYSeriesConfig[] = [
        { ...defaultFrameMatcher, name: { fixed: 'First' } },
        { ...defaultFrameMatcher },
      ];
      const { onChange, configAt } = renderEditor({
        value: twoSeries,
        contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
      });

      const firstRow = screen.getByRole('button', { name: /select series 1/i });
      const deleteBtn = within(firstRow).getByRole('button', { name: /delete series/i });
      await user.click(deleteBtn);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(configAt(0)).toHaveLength(1);
    });

    it('selects a series with the keyboard', () => {
      const twoSeries: XYSeriesConfig[] = [
        { ...defaultFrameMatcher, x: { matcher: { id: FieldMatcherID.byName, options: 'ax' } } },
        { ...defaultFrameMatcher, x: { matcher: { id: FieldMatcherID.byName, options: 'bx' } } },
      ];

      renderEditor({
        value: twoSeries,
        contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
      });

      expect(screen.getByTestId('field-name-picker-x')).toHaveTextContent('x (ax)');

      fireEvent.keyPress(screen.getByRole('button', { name: /select series 2/i }), { key: 'Enter', charCode: 13 });

      expect(screen.getByTestId('field-name-picker-x')).toHaveTextContent('x (bx)');
    });

    it('renames a series', async () => {
      const user = userEvent.setup();
      const { lastConfig } = renderEditor({
        contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
      });

      await user.click(screen.getByTestId('layer-name-div'));
      const input = screen.getByTestId('layer-name-input');
      await user.clear(input);
      await user.type(input, 'Revenue');
      await user.keyboard('{Enter}');

      expect(lastConfig()[0].name).toEqual({ fixed: 'Revenue' });
    });

    it('resets a series name to the default label', async () => {
      const user = userEvent.setup();
      const named: XYSeriesConfig[] = [{ ...defaultFrameMatcher, name: { fixed: 'Revenue' } }];
      const { lastConfig } = renderEditor({
        value: named,
        contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
      });

      await user.click(screen.getByTestId('layer-name-div'));
      const input = screen.getByTestId('layer-name-input');
      await user.clear(input);
      await user.type(input, 'Series 1');
      await user.keyboard('{Enter}');

      expect(lastConfig()[0].name).toEqual({ fixed: undefined });
    });

    it('resets the selected series to the first when the mapping changes', async () => {
      const user = userEvent.setup();
      const twoSeries: XYSeriesConfig[] = [
        { ...defaultFrameMatcher },
        { ...defaultFrameMatcher, x: { matcher: { id: FieldMatcherID.byName, options: 'bx' } } },
      ];

      const { rerenderEditor } = renderEditor({
        value: twoSeries,
        contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
      });

      await user.click(screen.getByRole('button', { name: /select series 2/i }));
      expect(screen.getByTestId('field-name-picker-x')).toHaveTextContent('x (bx)');

      rerenderEditor({ value: twoSeries, contextOverrides: { options: { mapping: SeriesMapping.Auto } as Options } });

      // The reset drops back to the default first series, so the X picker is empty again.
      expect(screen.getByTestId('field-name-picker-x')).toHaveTextContent('x (empty)');
    });
  });

  describe('config initialization', () => {
    it('resets the config when the panel mapping changes', () => {
      const customSeries: XYSeriesConfig[] = [
        {
          frame: { matcher: { id: FrameMatcherID.byIndex, options: 1 } },
          x: { matcher: { id: FieldMatcherID.byName, options: 'ax' } },
        },
      ];

      const { onChange, lastConfig, rerenderEditor } = renderEditor({
        value: customSeries,
        contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
      });

      rerenderEditor({
        value: customSeries,
        contextOverrides: { options: { mapping: SeriesMapping.Auto } as Options },
      });

      expect(onChange).toHaveBeenCalled();
      expect(lastConfig()).toEqual([{ ...defaultFrameMatcher }]);
    });

    it('initializes a default series when the config is missing', () => {
      // The panel option can be undefined before the editor has run once; SeriesEditor guards for it.
      const missingValue = null as unknown as XYSeriesConfig[];

      const { onChange } = renderEditor({ value: missingValue });

      expect(onChange).toHaveBeenCalledWith([{ ...defaultFrameMatcher }]);
    });
  });

  describe('dimension fields', () => {
    it.each(['x', 'y', 'size', 'color'] as Array<'x' | 'y' | 'size' | 'color'>)(
      'sets the %s field matcher',
      async (dim) => {
        const user = userEvent.setup();
        const { lastConfig } = renderEditor();

        await user.click(screen.getByTestId(`field-name-picker-${dim}`));

        expect(lastConfig()[0][dim]?.matcher).toEqual({ id: FieldMatcherID.byName, options: `${dim}-field` });
      }
    );

    it.each(['x', 'y', 'size', 'color'] as Array<'x' | 'y' | 'size' | 'color'>)('clears the %s field', async (dim) => {
      const user = userEvent.setup();
      const series: XYSeriesConfig[] = [
        {
          ...defaultFrameMatcher,
          x: { matcher: { id: FieldMatcherID.byName, options: 'ax' } },
          y: { matcher: { id: FieldMatcherID.byName, options: 'ay' } },
          size: { matcher: { id: FieldMatcherID.byName, options: 'ax' } },
          color: { matcher: { id: FieldMatcherID.byName, options: 'ay' } },
        },
      ];

      const { lastConfig } = renderEditor({ value: series });

      await user.click(screen.getByTestId(`field-name-picker-${dim}-clear`));

      expect(lastConfig()[0][dim]).toBeUndefined();
    });
  });

  describe('frame field', () => {
    it('sets the frame matcher when a frame is selected', async () => {
      const { lastConfig } = renderEditor();

      await selectOptionInTest(screen.getByLabelText('Frame'), /index: 1/);

      expect(lastConfig()[0].frame?.matcher).toEqual({ id: FrameMatcherID.byIndex, options: 1 });
    });

    it('clears the frame matcher when the selection is cleared', async () => {
      const user = userEvent.setup();
      const { lastConfig } = renderEditor();

      await user.click(screen.getByLabelText('Clear value'));

      expect(lastConfig()[0].frame).toBeUndefined();
    });
  });

  describe('field picker settings', () => {
    it.each([
      { dim: 'x', accepts: [FieldType.number, FieldType.time], rejects: [FieldType.string] },
      { dim: 'y', accepts: [FieldType.number], rejects: [FieldType.time, FieldType.string] },
      { dim: 'size', accepts: [FieldType.number], rejects: [FieldType.time, FieldType.string] },
      { dim: 'color', accepts: [FieldType.number], rejects: [FieldType.time, FieldType.string] },
    ] as Array<{ dim: 'x' | 'y' | 'size' | 'color'; accepts: FieldType[]; rejects: FieldType[] }>)(
      'filters the $dim field picker by field type',
      ({ dim, accepts, rejects }) => {
        renderEditor();

        const filter = pickerSettings(dim).filter;
        if (filter == null) {
          throw new Error(`expected a filter for the ${dim} picker`);
        }

        accepts.forEach((type) => expect(filter(makeField(type))).toBe(true));
        rejects.forEach((type) => expect(filter(makeField(type))).toBe(false));
      }
    );

    it('excludes fields hidden from the visualization', () => {
      renderEditor();

      const filter = pickerSettings('x').filter;
      if (filter == null) {
        throw new Error('expected a filter for the x picker');
      }

      const hiddenField = makeField(FieldType.number, { config: { custom: { hideFrom: { viz: true } } } });
      expect(filter(hiddenField)).toBe(false);
    });

    it.each(['x', 'y', 'size', 'color'] as Array<'x' | 'y' | 'size' | 'color'>)(
      'restricts the %s picker to the selected frame in manual mapping',
      (dim) => {
        const series: XYSeriesConfig[] = [{ frame: { matcher: { id: FrameMatcherID.byIndex, options: 1 } } }];

        renderEditor({
          value: series,
          contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
        });

        const filter = pickerSettings(dim).filter;
        if (filter == null) {
          throw new Error(`expected a filter for the ${dim} picker`);
        }

        const inSelectedFrame = makeField(FieldType.number, { state: { origin: { frameIndex: 1, fieldIndex: 0 } } });
        const inOtherFrame = makeField(FieldType.number, { state: { origin: { frameIndex: 0, fieldIndex: 0 } } });
        expect(filter(inSelectedFrame)).toBe(true);
        expect(filter(inOtherFrame)).toBe(false);
      }
    );

    it.each([
      { mapping: SeriesMapping.Manual, frames: 2, expected: FieldNamePickerBaseNameMode.ExcludeBaseNames },
      { mapping: SeriesMapping.Auto, frames: 1, expected: FieldNamePickerBaseNameMode.IncludeAll },
      { mapping: SeriesMapping.Auto, frames: 2, expected: FieldNamePickerBaseNameMode.OnlyBaseNames },
    ])(
      'uses the $expected base name mode for $mapping mapping with $frames frame(s)',
      ({ mapping, frames, expected }) => {
        renderEditor({
          contextOverrides: { data: makeTestData().slice(0, frames), options: { mapping } as Options },
        });

        expect(pickerSettings('x').baseNameMode).toBe(expected);
      }
    );
  });
});
