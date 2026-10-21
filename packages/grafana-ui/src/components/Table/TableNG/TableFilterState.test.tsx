import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
  createTheme,
  DataTransformerID,
  FieldType,
  toDataFrame,
  type DataTransformerConfig,
} from '@grafana/data';
import { FilterByValueMatch, FilterByValueType, type FilterByValueConfig } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { faro, LogLevel } from '@grafana/faro-web-sdk';
import { mockClientSize } from '@grafana/test-utils';

import { type PanelRuntimeTransformations } from '../../PanelChrome/PanelContext';

import { TableFilterProvider, useTableFilters } from './TableFilterContext';
import { TableNG } from './TableNG';

beforeAll(() => mockClientSize({ width: 800, height: 600 }));

function setup() {
  const data = applyFieldOverrides({
    data: [
      toDataFrame({
        fields: [
          { name: 'Name', type: FieldType.string, values: ['alpha', 'beta', 'gamma'] },
          { name: 'Other', type: FieldType.string, values: ['x', 'x', 'y'] },
        ],
      }),
    ],
    fieldConfig: { defaults: {}, overrides: [] },
    theme: createTheme(),
    replaceVariables: (s) => s,
  })[0];
  let configs: readonly DataTransformerConfig[] = [];
  const listeners = new Set<() => void>();
  const api: PanelRuntimeTransformations = {
    get: () => configs,
    set: (_owner, next) => {
      configs = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (_owner, listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSourceSeries: () => [data],
  };
  const frameKey = '[null,0,1]';
  const props = {
    data,
    width: 800,
    height: 600,
    rowTransformationsEnabled: true,
    rowTransformations: { api, owner: 'table', frameKey },
  };
  const filter = (name: string, values: string[]): FilterByValueConfig => ({
    id: DataTransformerID.filterByValue,
    options: {
      type: FilterByValueType.include,
      match: FilterByValueMatch.all,
      missingField: 'ignore',
      target: { frameKey },
      filters: [{ fieldName: name, field: { name }, config: { id: 'inSet', options: { mode: 'display', values } } }],
    },
  });
  return { props, api, filter };
}

it('updates one predicate without rewriting disabled, compound, other-frame or column configs', () => {
  const { props, api, filter } = setup();
  const selected = filter('Name', ['alpha']);
  const disabled = { ...filter('Name', ['gamma']), disabled: true };
  const compound = filter('Other', ['x']);
  compound.options.filters.push({ fieldName: 'Other', config: { id: 'isNotNull', options: {} } });
  const elsewhere = filter('Name', ['beta']);
  elsewhere.options.target = { frameKey: 'elsewhere' };
  const organize = { id: 'organize', options: { excludeByName: { Other: true } } };
  api.set('table', [selected, disabled, compound, elsewhere, organize]);
  const { result } = renderHook(useTableFilters, {
    wrapper: ({ children }) => <TableFilterProvider props={props}>{children}</TableFilterProvider>,
  });
  act(() =>
    result.current!.applyFilter(props.data.fields[0], { id: 'inSet', options: { mode: 'display', values: ['beta'] } })
  );
  expect(api.get('table')[0].options.filters[0].config.options.values).toEqual(['beta']);
  expect(api.get('table').slice(1)).toEqual([disabled, compound, elsewhere, organize]);
  act(() => result.current!.clearFilter(props.data.fields[0]));
  expect(api.get('table')).toEqual([disabled, compound, elsewhere, organize]);
  act(() => result.current!.clearFilters());
  expect(api.get('table')).toEqual([disabled, elsewhere, organize]);
});

it('serializes frame position separately from the opaque scope and hides stale scopes', () => {
  const { props, api } = setup();
  const frameKey = '[null,1,7]';
  props.rowTransformations = { ...props.rowTransformations, frameKey };
  const scopedProps = { ...props, rowTransformations: { ...props.rowTransformations, frameIndex: 1 } };
  const { result, rerender } = renderHook(useTableFilters, {
    wrapper: ({ children }) => <TableFilterProvider props={scopedProps}>{children}</TableFilterProvider>,
  });
  act(() =>
    result.current!.applyFilter(props.data.fields[0], { id: 'inSet', options: { mode: 'display', values: ['beta'] } })
  );
  expect(api.get('table')[0].options.target).toEqual({ frameKey, frameIndex: 1 });
  expect(result.current!.getFilters(props.data.fields[0])).toHaveLength(1);
  scopedProps.rowTransformations = { ...scopedProps.rowTransformations, frameKey: '[null,1,8]' };
  rerender();
  expect(result.current!.getFilters(props.data.fields[0])).toEqual([]);
});

it.each([false, true])('replaces and clears stale nested filters (compound=%s)', (compound) => {
  const { props, api } = setup();
  const original = props.data;
  const { result, rerender } = renderHook(useTableFilters, {
    wrapper: ({ children }) => <TableFilterProvider props={props}>{children}</TableFilterProvider>,
  });
  act(() =>
    result.current!.applyFilter(original.fields[0], { id: 'inSet', options: { mode: 'display', values: ['alpha'] } }, 0)
  );
  if (compound) {
    const saved = api.get('table')[0] as FilterByValueConfig;
    act(() =>
      api.set('table', [
        {
          ...saved,
          options: {
            ...saved.options,
            filters: [...saved.options.filters, { fieldName: 'Other', config: { id: 'isNotNull', options: {} } }],
          },
        },
      ])
    );
  }

  props.data = {
    ...original,
    fields: original.fields.map((field, index) =>
      index === 0 ? { ...field, values: ['changed', 'beta', 'gamma'] } : field
    ),
  };
  rerender();
  expect(result.current!.getFilters(props.data.fields[0], 0)).toEqual([]);

  act(() =>
    result.current!.applyFilter(
      props.data.fields[0],
      { id: 'inSet', options: { mode: 'display', values: ['beta'] } },
      0
    )
  );
  expect(api.get('table')).toHaveLength(1);
  expect(result.current!.getFilters(props.data.fields[0], 0)[0].options.filters[0].config.options.values).toEqual([
    'beta',
  ]);

  props.data = original;
  rerender();
  expect(result.current!.getFilters(original.fields[0], 0)).toEqual([]);
  act(() => result.current!.clearFilter(original.fields[0], 0));
  expect(api.get('table')).toEqual([]);
});

it('restores checkbox controls from JSON and replaces an open draft only when its predicate changes', async () => {
  const { props, api, filter } = setup();
  api.set('table', JSON.parse(JSON.stringify([filter('Name', ['alpha', 'beta'])])));
  render(<TableNG {...props} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Filter Name' }));
  expect(screen.getByRole('checkbox', { name: 'alpha' })).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'alpha' }));
  act(() => api.set('table', [...api.get('table'), filter('Other', ['x'])]));
  expect(screen.getByRole('checkbox', { name: 'alpha' })).not.toBeChecked();
  act(() => api.set('table', [filter('Name', ['alpha']), filter('Other', ['x'])]));
  expect(screen.getByRole('checkbox', { name: 'alpha' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'beta' })).not.toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'beta' }));
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.get('table')[0].options.filters[0].config.options.values).toEqual(['alpha']);
  expect(
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('gridcell')[0].textContent)
  ).toEqual(['alpha']);
});

it('interprets a new time range bound in the panel timezone', async () => {
  const { props, api } = setup();
  const timeZone = 'Pacific/Auckland';
  props.data = applyFieldOverrides({
    data: [
      toDataFrame({
        fields: [{ name: 'Time', type: FieldType.time, values: [1767225600000, 1767312000000] }],
      }),
    ],
    fieldConfig: { defaults: {}, overrides: [] },
    theme: createTheme(),
    timeZone,
    replaceVariables: (s) => s,
  })[0];
  render(<TableNG {...props} timeZone={timeZone} />);
  await userEvent.click(screen.getByRole('button', { name: 'Filter Time' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Start' }), '2026-01-01 13:00:00.000');
  await userEvent.type(screen.getByRole('textbox', { name: 'End' }), '2026-01-01 13:00:00.000');
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(api.get('table')[0].options.filters[0].config).toEqual({
    id: 'between',
    options: {
      from: 1767225600000,
      to: 1767225600000,
      inclusive: true,
      allowOpenBounds: true,
      includeMissing: false,
    },
  });
  expect(screen.getAllByRole('row')).toHaveLength(2);
});

it('keeps time range bounds editable after the panel timezone changes', async () => {
  const { props, api } = setup();
  const first = 1767225600000;
  const second = 1767312000000;
  const makeFrame = (timeZone: string) =>
    applyFieldOverrides({
      data: [toDataFrame({ fields: [{ name: 'Time', type: FieldType.time, values: [first, second] }] })],
      fieldConfig: { defaults: {}, overrides: [] },
      theme: createTheme(),
      timeZone,
      replaceVariables: (s) => s,
    })[0];
  props.data = makeFrame('UTC');
  const { rerender } = render(<TableNG {...props} timeZone="UTC" />);

  await userEvent.click(screen.getByRole('button', { name: 'Filter Time' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Start' }), '2026-01-01 00:00:00.000');
  await userEvent.type(screen.getByRole('textbox', { name: 'End' }), '2026-01-01 00:00:00.000');
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(screen.getAllByRole('row')).toHaveLength(2);

  props.data = makeFrame('Pacific/Auckland');
  rerender(<TableNG {...props} timeZone="Pacific/Auckland" />);
  await userEvent.click(screen.getByRole('button', { name: 'Filter Time' }));
  expect(screen.getByRole('textbox', { name: 'Start' })).toHaveValue('2026-01-01 13:00:00.000');
  expect(screen.getByRole('textbox', { name: 'End' })).toHaveValue('2026-01-01 13:00:00.000');
  await userEvent.clear(screen.getByRole('textbox', { name: 'End' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'End' }), '2026-01-02 13:00:00.000');
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(screen.getAllByRole('row')).toHaveLength(3);
  expect(api.get('table')[0].options.filters[0].config).toMatchObject({
    id: 'between',
    options: { from: first, to: second },
  });
});

it.each([false, true])(
  'hides compound filters in the header without removing them (refresh=%s)',
  async (tableRefreshEnabled) => {
    const { props, api, filter } = setup();
    const compound = filter('Name', ['alpha', 'beta']);
    compound.options.filters.push({ fieldName: 'Other', config: { id: 'inSet', options: { values: ['x'] } } });
    api.set('table', [compound]);
    render(
      <TableNG
        {...props}
        tableRefreshEnabled={tableRefreshEnabled}
        onFieldAddToAssistant={tableRefreshEnabled ? jest.fn() : undefined}
      />
    );

    expect(screen.queryByRole('button', { name: 'Filter Name' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit filter on Name' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(api.get('table')).toEqual([compound]);
    expect(screen.queryByRole('button', { name: 'Filter Other' })).not.toBeInTheDocument();
    if (tableRefreshEnabled) {
      await userEvent.click(screen.getByRole('button', { name: 'Column options for Name' }));
      expect(screen.queryByRole('menuitem', { name: 'Filter values' })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Add to Assistant' })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole('button', { name: 'Column options for Name' })).not.toBeInTheDocument();
    }
  }
);

it('hides an unfamiliar predicate while keeping it active', () => {
  const { props, api, filter } = setup();
  const opaque = filter('Name', ['alpha']);
  opaque.options.filters[0].config = { id: 'isNotNull', options: {} };
  api.set('table', [opaque]);
  const warning = jest.spyOn(faro.api, 'pushLog').mockImplementation(() => {});

  const { rerender } = render(<TableNG {...props} />);

  expect(screen.queryByRole('button', { name: 'Filter Name' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(4);
  expect(api.get('table')).toEqual([opaque]);
  expect(warning).toHaveBeenCalledWith(['Table filter is not editable in the header; filter control hidden.'], {
    level: LogLevel.WARN,
    context: { source: 'TableNG.HeaderCell', reason: 'uneditable' },
  });

  rerender(<TableNG {...props} />);
  expect(warning).toHaveBeenCalledTimes(1);
  warning.mockRestore();
});

it('shows unfiltered rows and disables filter controls after projection fails, then recovers on configuration change', () => {
  const { props, api, filter } = setup();
  const invalid = filter('Name', ['alpha']);
  invalid.options.filters[0].config.id = 'missingMatcher';
  api.set('table', [invalid]);
  const notify = jest.fn();
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const report = jest.spyOn(faro.api, 'pushError').mockImplementation(() => {});
  const { rerender } = render(<TableNG {...props} onFilterError={notify} />);

  expect(screen.getAllByRole('row')).toHaveLength(4);
  expect(screen.getByRole('button', { name: 'Filter Other' })).toBeDisabled();
  expect(api.get('table')).toEqual([invalid]);
  expect(notify).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('missingMatcher') }), {
    context: { source: 'TableNG.filter' },
  });

  rerender(<TableNG {...props} onFilterError={notify} />);
  expect(notify).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledTimes(1);

  act(() => api.set('table', [filter('Name', ['alpha'])]));
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Filter Other' })).toBeEnabled();
  expect(notify).toHaveBeenCalledTimes(1);
  report.mockRestore();
  consoleError.mockRestore();
});

it('keeps dashboard cell filter actions available when value filtering fails', async () => {
  const { props, api, filter } = setup();
  props.data.fields[1].config.filterable = true;
  const invalid = filter('Name', ['alpha']);
  invalid.options.filters[0].config.id = 'missingMatcher';
  api.set('table', [invalid]);
  const onCellFilterAdded = jest.fn();
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<TableNG {...props} onCellFilterAdded={onCellFilterAdded} />);

  expect(screen.getByRole('button', { name: 'Filter Other' })).toBeDisabled();
  const cell = screen.getAllByRole('gridcell', { name: 'x' })[0];
  await userEvent.click(
    within(cell).getByTestId(selectors.components.Panels.Visualization.TableNG.cellActions.filterForButton)
  );
  expect(onCellFilterAdded).toHaveBeenCalledWith({ key: 'Other', operator: '=', value: 'x' });
  consoleError.mockRestore();
});

it('removes refreshed-header filter actions while filtering is disabled', async () => {
  const { props, api, filter } = setup();
  const invalid = filter('Name', ['alpha']);
  invalid.options.filters[0].config.id = 'missingMatcher';
  api.set('table', [invalid]);
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<TableNG {...props} tableRefreshEnabled onFieldAddToAssistant={jest.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: 'Column options for Other' }));
  expect(screen.queryByRole('menuitem', { name: 'Filter values' })).not.toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Add to Assistant' })).toBeInTheDocument();
  consoleError.mockRestore();
});

it('retries filtering when table data changes, reporting only once per failed attempt', () => {
  const { props, api, filter } = setup();
  const invalid = filter('Name', ['alpha']);
  invalid.options.filters[0].config.id = 'missingMatcher';
  api.set('table', [invalid]);
  const notify = jest.fn();
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const report = jest.spyOn(faro.api, 'pushError').mockImplementation(() => {});
  const { rerender } = render(<TableNG {...props} onFilterError={notify} />);
  props.data = { ...props.data };
  rerender(<TableNG {...props} onFilterError={notify} />);

  expect(screen.getAllByRole('row')).toHaveLength(4);
  expect(notify).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenCalledTimes(2);
  report.mockRestore();
  consoleError.mockRestore();
});

it('shows parent rows and keeps cell filter actions when a nested filter fails', async () => {
  const { props, api, filter } = setup();
  const nested = toDataFrame({ fields: [{ name: 'Nested', type: FieldType.string, values: ['one', 'two'] }] });
  props.data = applyFieldOverrides({
    data: [
      toDataFrame({
        fields: [
          { name: 'Name', type: FieldType.string, values: ['alpha', 'beta'] },
          { name: '__nestedFrames', type: FieldType.nestedFrames, values: [[nested], [nested]] },
        ],
      }),
    ],
    fieldConfig: { defaults: {}, overrides: [] },
    theme: createTheme(),
    replaceVariables: (s) => s,
  })[0];
  props.data.fields[0].config.filterable = true;
  const invalid = filter('Nested', ['one']);
  invalid.options.target = { frameKey: props.rowTransformations.frameKey, parentIndex: 0 };
  invalid.options.filters[0].config.id = 'missingMatcher';
  api.set('table', [invalid]);
  const notify = jest.fn();
  const onCellFilterAdded = jest.fn();
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<TableNG {...props} onFilterError={notify} onCellFilterAdded={onCellFilterAdded} />);

  expect(screen.getByText('alpha')).toBeInTheDocument();
  expect(screen.getByText('beta')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Filter Name' })).toBeDisabled();
  await userEvent.click(
    within(screen.getByRole('gridcell', { name: 'alpha' })).getByTestId(
      selectors.components.Panels.Visualization.TableNG.cellActions.filterForButton
    )
  );
  expect(onCellFilterAdded).toHaveBeenCalledWith({ key: 'Name', operator: '=', value: 'alpha' });
  expect(notify).toHaveBeenCalledTimes(1);
  expect(api.get('table')).toEqual([invalid]);
  consoleError.mockRestore();
});

it('does not recover unrelated table rendering errors as filter failures', () => {
  const { props } = setup();
  const notify = jest.fn();
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const BrokenTable = () => {
    throw new Error('render failed');
  };

  expect(() =>
    render(
      <TableFilterProvider props={{ ...props, onFilterError: notify }}>
        <BrokenTable />
      </TableFilterProvider>
    )
  ).toThrow('render failed');
  expect(notify).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

it('keeps the filtered rows without adding a clear-all control', () => {
  const { props, api, filter } = setup();
  api.set('table', [filter('Name', ['alpha'])]);
  render(<TableNG {...props} />);

  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.queryByRole('button', { name: /Clear filters/ })).not.toBeInTheDocument();
});

it('uses local filter state without row transformations enabled', async () => {
  const { props } = setup();
  props.data.fields[0].config.custom = { filterable: true };
  render(<TableNG {...props} rowTransformationsEnabled={false} rowTransformations={undefined} />);

  await userEvent.click(screen.getByRole('button', { name: 'Filter Name' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'alpha' }));
  await userEvent.click(screen.getByRole('button', { name: 'Ok' }));

  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getByRole('gridcell', { name: 'alpha' })).toBeInTheDocument();
});

it('hides local filters for fields with duplicate identities', () => {
  const { props } = setup();
  props.data = applyFieldOverrides({
    data: [
      toDataFrame({
        fields: [
          {
            name: 'x',
            type: FieldType.string,
            values: ['a1', 'a2', 'a3'],
            config: { displayName: 'First', custom: { filterable: true } },
          },
          {
            name: 'x',
            type: FieldType.string,
            values: ['b1', 'b2', 'b3'],
            config: { displayName: 'Second', custom: { filterable: true } },
          },
          {
            name: 'y',
            type: FieldType.string,
            values: ['c1', 'c2', 'c3'],
            config: { displayName: 'Unique', custom: { filterable: true } },
          },
        ],
      }),
    ],
    fieldConfig: { defaults: {}, overrides: [] },
    theme: createTheme(),
    replaceVariables: (value) => value,
  })[0];

  render(<TableNG {...props} rowTransformationsEnabled={false} rowTransformations={undefined} />);

  expect(screen.getByRole('gridcell', { name: 'b2' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Filter Unique' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Filter First' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Filter Second' })).not.toBeInTheDocument();
});

it('clears an active filter when its field stops being filterable', () => {
  const { props, api, filter } = setup();
  api.set('table', [filter('Name', ['alpha'])]);
  props.data.fields[0].config.custom = { filterable: false };

  render(<TableNG {...props} />);

  expect(api.get('table')).toEqual([]);
  expect(screen.getAllByRole('row')).toHaveLength(4);
});

it('does not clear an opaque filter when its field is not filterable', () => {
  const { props, api, filter } = setup();
  const opaque = filter('Name', ['alpha']);
  opaque.options.filters[0].config = { id: 'isNotNull', options: {} };
  api.set('table', [opaque]);
  props.data.fields[0].config.custom = { filterable: false };

  render(<TableNG {...props} />);

  expect(api.get('table')).toEqual([opaque]);
  expect(screen.queryByRole('button', { name: 'Filter Name' })).not.toBeInTheDocument();
});
