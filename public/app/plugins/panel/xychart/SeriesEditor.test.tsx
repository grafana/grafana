import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

import { SeriesEditor } from './SeriesEditor';
import { type Options, type XYSeriesConfig, SeriesMapping } from './panelcfg.gen';

// The picker items built by SeriesEditor are captured here on render so tests can
// assert on the `filter` and `baseNameMode` settings passed to each FieldNamePicker.
let mockPickerItems: Record<string, { id: string; name: string; settings?: FieldNamePickerConfigSettings }> = {};

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  return {
    ...actual,
    Select: ({
      options,
      onChange,
    }: {
      options: Array<{ value: number; label: string }>;
      onChange: (value: { value: number } | null) => void;
    }) => (
      <div data-testid="frame-select">
        {options.map((opt) => (
          <button key={opt.value} type="button" data-testid={`frame-option-${opt.value}`} onClick={() => onChange(opt)}>
            {opt.label}
          </button>
        ))}
        <button type="button" data-testid="frame-option-clear" onClick={() => onChange(null)}>
          clear frame
        </button>
      </div>
    ),
  };
});

jest.mock('@grafana/ui/internal', () => {
  const actual = jest.requireActual('@grafana/ui/internal');
  return {
    ...actual,
    FieldNamePicker: ({
      item,
      onChange,
      value,
    }: {
      item: { id: string; name: string };
      onChange: (v: string | null | undefined) => void;
      value?: string;
    }) => {
      mockPickerItems[item.id] = item;
      return (
        <>
          <button
            type="button"
            data-testid={`field-name-picker-${item.id}`}
            onClick={() => onChange(`${item.id}-field`)}
          >
            {item.name} ({value ?? 'empty'})
          </button>
          <button type="button" data-testid={`field-name-picker-${item.id}-clear`} onClick={() => onChange(null)}>
            clear {item.name}
          </button>
        </>
      );
    },
  };
});

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

const minimalItem: StandardEditorProps<XYSeriesConfig[], unknown, Options>['item'] = {
  id: 'series-editor',
  name: 'Series',
};

function buildProps(
  overrides: Partial<StandardEditorProps<XYSeriesConfig[], unknown, Options>> & {
    contextOverrides?: Partial<StandardEditorProps<XYSeriesConfig[], unknown, Options>['context']>;
  }
): StandardEditorProps<XYSeriesConfig[], unknown, Options> {
  const { value = [{ ...defaultFrameMatcher }], onChange = jest.fn(), contextOverrides, ...rest } = overrides;

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

describe('SeriesEditor', () => {
  beforeEach(() => {
    mockPickerItems = {};
  });

  describe('rendering', () => {
    it('renders frame and dimension fields in auto mapping mode', () => {
      render(<SeriesEditor {...buildProps({})} />);

      expect(screen.getByText('Frame')).toBeVisible();
      expect(screen.getByText('X field')).toBeVisible();
      expect(screen.getByText('Y field')).toBeVisible();
      expect(screen.getByText('Size field')).toBeVisible();
      expect(screen.getByText('Color field')).toBeVisible();
    });

    it('shows the series list and add button in manual mapping', () => {
      render(
        <SeriesEditor
          {...buildProps({
            contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
          })}
        />
      );

      expect(screen.getByRole('button', { name: /add series/i })).toBeVisible();
      expect(screen.getByTestId('layer-name-div')).toBeVisible();
      expect(screen.getByText('Series 1')).toBeVisible();
    });
  });

  describe('series management', () => {
    it('adds a series', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      const initial: XYSeriesConfig[] = [{ ...defaultFrameMatcher }];

      render(
        <SeriesEditor
          {...buildProps({
            value: initial,
            onChange,
            contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
          })}
        />
      );

      await user.click(screen.getByRole('button', { name: /add series/i }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const next = onChange.mock.calls[0][0] as XYSeriesConfig[];
      expect(next).toHaveLength(2);
      expect(next[1]).toEqual(defaultFrameMatcher);
    });

    it('deletes a series', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      const twoSeries: XYSeriesConfig[] = [
        { ...defaultFrameMatcher, name: { fixed: 'First' } },
        { ...defaultFrameMatcher },
      ];

      render(
        <SeriesEditor
          {...buildProps({
            value: twoSeries,
            onChange,
            contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
          })}
        />
      );

      const firstRow = screen.getByRole('button', { name: /select series 1/i });
      const deleteBtn = within(firstRow).getByRole('button', { name: /delete series/i });
      await user.click(deleteBtn);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect((onChange.mock.calls[0][0] as XYSeriesConfig[]).length).toBe(1);
    });

    it('selects a series with the keyboard', () => {
      const twoSeries: XYSeriesConfig[] = [
        { ...defaultFrameMatcher, x: { matcher: { id: FieldMatcherID.byName, options: 'ax' } } },
        { ...defaultFrameMatcher, x: { matcher: { id: FieldMatcherID.byName, options: 'bx' } } },
      ];

      render(
        <SeriesEditor
          {...buildProps({
            value: twoSeries,
            contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
          })}
        />
      );

      expect(screen.getByTestId('field-name-picker-x')).toHaveTextContent('x (ax)');

      fireEvent.keyPress(screen.getByRole('button', { name: /select series 2/i }), { key: 'Enter', charCode: 13 });

      expect(screen.getByTestId('field-name-picker-x')).toHaveTextContent('x (bx)');
    });

    it('renames a series', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(
        <SeriesEditor
          {...buildProps({
            onChange,
            contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
          })}
        />
      );

      await user.click(screen.getByTestId('layer-name-div'));
      const input = screen.getByTestId('layer-name-input');
      await user.clear(input);
      await user.type(input, 'Revenue');
      await user.keyboard('{Enter}');

      const next = onChange.mock.calls.at(-1)![0] as XYSeriesConfig[];
      expect(next[0].name).toEqual({ fixed: 'Revenue' });
    });

    it('resets a series name to the default label', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      const named: XYSeriesConfig[] = [{ ...defaultFrameMatcher, name: { fixed: 'Revenue' } }];

      render(
        <SeriesEditor
          {...buildProps({
            value: named,
            onChange,
            contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
          })}
        />
      );

      await user.click(screen.getByTestId('layer-name-div'));
      const input = screen.getByTestId('layer-name-input');
      await user.clear(input);
      await user.type(input, 'Series 1');
      await user.keyboard('{Enter}');

      const next = onChange.mock.calls.at(-1)![0] as XYSeriesConfig[];
      expect(next[0].name).toEqual({ fixed: undefined });
    });

    it('resets the selected series to the first when the mapping changes', async () => {
      const user = userEvent.setup();
      const twoSeries: XYSeriesConfig[] = [
        { ...defaultFrameMatcher },
        { ...defaultFrameMatcher, x: { matcher: { id: FieldMatcherID.byName, options: 'bx' } } },
      ];

      const { rerender } = render(
        <SeriesEditor
          {...buildProps({
            value: twoSeries,
            contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
          })}
        />
      );

      await user.click(screen.getByRole('button', { name: /select series 2/i }));
      expect(screen.getByTestId('field-name-picker-x')).toHaveTextContent('x (bx)');

      rerender(
        <SeriesEditor
          {...buildProps({
            value: twoSeries,
            contextOverrides: { options: { mapping: SeriesMapping.Auto } as Options },
          })}
        />
      );

      // The reset drops back to the default first series, so the X picker is empty again.
      expect(screen.getByTestId('field-name-picker-x')).toHaveTextContent('x (empty)');
    });
  });

  describe('config initialization', () => {
    it('resets the config when the panel mapping changes', () => {
      const onChange = jest.fn();
      const customSeries: XYSeriesConfig[] = [
        {
          frame: { matcher: { id: FrameMatcherID.byIndex, options: 1 } },
          x: { matcher: { id: FieldMatcherID.byName, options: 'ax' } },
        },
      ];

      const { rerender } = render(
        <SeriesEditor
          {...buildProps({
            value: customSeries,
            onChange,
            contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
          })}
        />
      );

      rerender(
        <SeriesEditor
          {...buildProps({
            value: customSeries,
            onChange,
            contextOverrides: { options: { mapping: SeriesMapping.Auto } as Options },
          })}
        />
      );

      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.calls.at(-1)![0]).toEqual([{ ...defaultFrameMatcher }]);
    });

    it('initializes a default series when the config is missing', () => {
      const onChange = jest.fn();
      // The panel option can be undefined before the editor has run once; SeriesEditor guards for it.
      const missingValue = null as unknown as XYSeriesConfig[];

      render(<SeriesEditor {...buildProps({ onChange })} value={missingValue} />);

      expect(onChange).toHaveBeenCalledWith([{ ...defaultFrameMatcher }]);
    });
  });

  describe('dimension fields', () => {
    it.each(['x', 'y', 'size', 'color'] as Array<'x' | 'y' | 'size' | 'color'>)(
      'sets the %s field matcher',
      async (dim) => {
        const user = userEvent.setup();
        const onChange = jest.fn();

        render(<SeriesEditor {...buildProps({ onChange })} />);

        await user.click(screen.getByTestId(`field-name-picker-${dim}`));

        const next = onChange.mock.calls.at(-1)![0] as XYSeriesConfig[];
        expect(next[0][dim]?.matcher).toEqual({ id: FieldMatcherID.byName, options: `${dim}-field` });
      }
    );

    it.each(['x', 'y', 'size', 'color'] as Array<'x' | 'y' | 'size' | 'color'>)('clears the %s field', async (dim) => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      const series: XYSeriesConfig[] = [
        {
          ...defaultFrameMatcher,
          x: { matcher: { id: FieldMatcherID.byName, options: 'ax' } },
          y: { matcher: { id: FieldMatcherID.byName, options: 'ay' } },
          size: { matcher: { id: FieldMatcherID.byName, options: 'ax' } },
          color: { matcher: { id: FieldMatcherID.byName, options: 'ay' } },
        },
      ];

      render(<SeriesEditor {...buildProps({ value: series, onChange })} />);

      await user.click(screen.getByTestId(`field-name-picker-${dim}-clear`));

      const next = onChange.mock.calls.at(-1)![0] as XYSeriesConfig[];
      expect(next[0][dim]).toBeUndefined();
    });
  });

  describe('frame field', () => {
    it('sets the frame matcher when a frame is selected', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<SeriesEditor {...buildProps({ onChange })} />);

      await user.click(screen.getByTestId('frame-option-1'));

      const next = onChange.mock.calls.at(-1)![0] as XYSeriesConfig[];
      expect(next[0].frame?.matcher).toEqual({ id: FrameMatcherID.byIndex, options: 1 });
    });

    it('clears the frame matcher when the selection is cleared', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<SeriesEditor {...buildProps({ onChange })} />);

      await user.click(screen.getByTestId('frame-option-clear'));

      const next = onChange.mock.calls.at(-1)![0] as XYSeriesConfig[];
      expect(next[0].frame).toBeUndefined();
    });
  });

  describe('field picker settings', () => {
    it.each([
      { dim: 'x', accepts: [FieldType.number, FieldType.time], rejects: [FieldType.string] },
      { dim: 'y', accepts: [FieldType.number], rejects: [FieldType.time, FieldType.string] },
      { dim: 'size', accepts: [FieldType.number], rejects: [FieldType.time, FieldType.string] },
      { dim: 'color', accepts: [FieldType.number], rejects: [FieldType.time, FieldType.string] },
    ])('filters the $dim field picker by field type', ({ dim, accepts, rejects }) => {
      render(<SeriesEditor {...buildProps({})} />);

      const filter = mockPickerItems[dim].settings?.filter;
      if (filter == null) {
        throw new Error(`expected a filter for the ${dim} picker`);
      }

      accepts.forEach((type) => expect(filter(makeField(type))).toBe(true));
      rejects.forEach((type) => expect(filter(makeField(type))).toBe(false));
    });

    it('excludes fields hidden from the visualization', () => {
      render(<SeriesEditor {...buildProps({})} />);

      const filter = mockPickerItems.x.settings?.filter;
      if (filter == null) {
        throw new Error('expected a filter for the x picker');
      }

      const hiddenField = makeField(FieldType.number, { config: { custom: { hideFrom: { viz: true } } } });
      expect(filter(hiddenField)).toBe(false);
    });

    it.each(['x', 'y', 'size', 'color'])('restricts the %s picker to the selected frame in manual mapping', (dim) => {
      const series: XYSeriesConfig[] = [{ frame: { matcher: { id: FrameMatcherID.byIndex, options: 1 } } }];

      render(
        <SeriesEditor
          {...buildProps({
            value: series,
            contextOverrides: { options: { mapping: SeriesMapping.Manual } as Options },
          })}
        />
      );

      const filter = mockPickerItems[dim].settings?.filter;
      if (filter == null) {
        throw new Error(`expected a filter for the ${dim} picker`);
      }

      const inSelectedFrame = makeField(FieldType.number, { state: { origin: { frameIndex: 1, fieldIndex: 0 } } });
      const inOtherFrame = makeField(FieldType.number, { state: { origin: { frameIndex: 0, fieldIndex: 0 } } });
      expect(filter(inSelectedFrame)).toBe(true);
      expect(filter(inOtherFrame)).toBe(false);
    });

    it.each([
      { mapping: SeriesMapping.Manual, frames: 2, expected: FieldNamePickerBaseNameMode.ExcludeBaseNames },
      { mapping: SeriesMapping.Auto, frames: 1, expected: FieldNamePickerBaseNameMode.IncludeAll },
      { mapping: SeriesMapping.Auto, frames: 2, expected: FieldNamePickerBaseNameMode.OnlyBaseNames },
    ])(
      'uses the $expected base name mode for $mapping mapping with $frames frame(s)',
      ({ mapping, frames, expected }) => {
        render(
          <SeriesEditor
            {...buildProps({
              contextOverrides: { data: makeTestData().slice(0, frames), options: { mapping } as Options },
            })}
          />
        );

        expect(mockPickerItems.x.settings?.baseNameMode).toBe(expected);
      }
    );
  });
});
