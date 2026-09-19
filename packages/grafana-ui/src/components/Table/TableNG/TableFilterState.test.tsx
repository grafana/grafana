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
import { FilterByValueMatch, FilterByValueType, tableFrameKey, type FilterByValueConfig } from '@grafana/data/internal';
import { mockClientSize } from '@grafana/test-utils';

import { type AdHocTransformationsApi } from '../../PanelChrome/PanelContext';

import { TableNG } from './TableNG';
import { TableViewProvider, useTableView } from './TableViewContext';
import { TABLE } from './constants';
import { useContentAwareWidths, useHeaderHeight } from './hooks';
import { createTypographyContext, computeContentAwareColWidths } from './utils';

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
  const api: AdHocTransformationsApi = {
    get: () => configs,
    set: (next) => {
      configs = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSourceSeries: () => [data],
  };
  const frameKey = tableFrameKey([data], 0);
  const props = {
    data,
    width: 800,
    height: 600,
    rowTransformationsEnabled: true,
    rowTransformations: { api, frameKey },
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
  api.set([selected, disabled, compound, elsewhere, organize]);
  const { result } = renderHook(useTableView, {
    wrapper: ({ children }) => <TableViewProvider props={props}>{children}</TableViewProvider>,
  });
  act(() =>
    result.current!.applyFilter(props.data.fields[0], { id: 'inSet', options: { mode: 'display', values: ['beta'] } })
  );
  expect(api.get()[0].options.filters[0].config.options.values).toEqual(['beta']);
  expect(api.get().slice(1)).toEqual([disabled, compound, elsewhere, organize]);
  expect(api.get()[2]).toBe(compound);
  act(() => result.current!.clearFilter(props.data.fields[0]));
  expect(api.get()).toEqual([disabled, compound, elsewhere, organize]);
  act(() => result.current!.clearFilters());
  expect(api.get()).toEqual([disabled, elsewhere, organize]);
});

it('restores checkbox controls from JSON and replaces an open draft only when its predicate changes', async () => {
  const { props, api, filter } = setup();
  api.set(JSON.parse(JSON.stringify([filter('Name', ['alpha', 'beta'])])));
  render(<TableNG {...props} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Filter Name' }));
  expect(screen.getByRole('checkbox', { name: 'alpha' })).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'alpha' }));
  act(() => api.set([...api.get(), filter('Other', ['x'])]));
  expect(screen.getByRole('checkbox', { name: 'alpha' })).not.toBeChecked();
  act(() => api.set([filter('Name', ['alpha']), filter('Other', ['x'])]));
  expect(screen.getByRole('checkbox', { name: 'alpha' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'beta' })).not.toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'beta' }));
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.get()[0].options.filters[0].config.options.values).toEqual(['alpha']);
  expect(
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('gridcell')[0].textContent)
  ).toEqual(['alpha']);
});

it('shows compound filters without flattening them and permits explicit clearing', async () => {
  const { props, api, filter } = setup();
  const compound = filter('Name', ['alpha', 'beta']);
  compound.options.filters.push({ fieldName: 'Other', config: { id: 'inSet', options: { values: ['x'] } } });
  api.set([compound]);
  render(<TableNG {...props} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Filter Name' }));
  expect(screen.getByRole('status')).toHaveTextContent('This filter cannot be edited here.');
  expect(api.get()[0]).toBe(compound);
  await user.click(screen.getByRole('button', { name: 'Clear filter' }));
  expect(screen.getAllByRole('row')).toHaveLength(4);
  expect(api.get()).toEqual([]);
});

it('reserves header height and automatic width for a filter on any nested parent', () => {
  const { props, api, filter } = setup();
  const field = props.data.fields[0];
  field.config.custom = { wrapHeaderText: true, filterable: true };
  const nested = filter('Name', ['alpha']);
  nested.options.target = { ...nested.options.target!, parentIndex: 1 };
  api.set([nested]);
  const measureHeight = jest.fn(() => 20);
  const typographyCtx = { ...createTypographyContext(14, 'sans-serif'), measureHeight };
  const { result } = renderHook(
    () => {
      useHeaderHeight({
        fields: [field],
        columnWidths: [100],
        enabled: true,
        typographyCtx,
        tableRefreshEnabled: true,
      });
      return useContentAwareWidths({ enabled: true, typographyCtx, tableRefreshEnabled: true });
    },
    { wrapper: ({ children }) => <TableViewProvider props={props}>{children}</TableViewProvider> }
  );
  expect(measureHeight).toHaveBeenCalledWith('Name', 21, field, -1, TABLE.HEADER_LINE_HEIGHT);
  expect(
    computeContentAwareColWidths([field], 0, {
      ...result.current!,
      headerTypographyCtx: { ...typographyCtx, measureWidth: () => 200 },
    })
  ).toEqual([279]);
});
