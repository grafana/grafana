import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDataFrame, FieldMatcherID, FieldType, FrameMatcherID, type StandardEditorProps } from '@grafana/data';

import { SeriesEditor } from './SeriesEditor';
import { type Options, type XYSeriesConfig, SeriesMapping } from './panelcfg.gen';

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
    }) => (
      <button type="button" data-testid={`field-name-picker-${item.id}`} onClick={() => onChange(`${item.id}-field`)}>
        {item.name} ({value ?? 'empty'})
      </button>
    ),
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
  it('renders frame and dimension fields in auto mapping mode', () => {
    render(<SeriesEditor {...buildProps({})} />);

    expect(screen.getByText('Frame')).toBeVisible();
    expect(screen.getByText('X field')).toBeVisible();
    expect(screen.getByText('Y field')).toBeVisible();
    expect(screen.getByText('Size field')).toBeVisible();
    expect(screen.getByText('Color field')).toBeVisible();
  });

  it('shows add series in manual mapping', () => {
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

  it('updates x field', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<SeriesEditor {...buildProps({ onChange })} />);

    await user.click(screen.getByTestId('field-name-picker-x'));

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as XYSeriesConfig[];
    expect(next[0].x?.matcher).toEqual({ id: FieldMatcherID.byName, options: 'x-field' });
  });

  it('resets series config when panel mapping changes', () => {
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
});
