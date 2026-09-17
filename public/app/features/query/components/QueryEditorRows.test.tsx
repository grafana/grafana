import { act, queryByLabelText, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { DataSourceApi } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import type { DataSourceSrv, GetDataSourceListFilters } from '@grafana/runtime';
import { type DataSourceRef, type DataQuery } from '@grafana/schema';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import createMockPanelData from 'app/plugins/datasource/azuremonitor/mocks/panelData';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { QueryEditorRows, type Props } from './QueryEditorRows';

const mockDS = mockDataSource({
  name: 'CloudManager',
  type: DataSourceType.Alertmanager,
});

const mockVariable = mockDataSource({
  name: '${dsVariable}',
  type: 'datasource',
});

const dsSrvMock: Pick<DataSourceSrv, 'get' | 'getList' | 'getInstanceSettings'> = {
  get: jest.fn(
    async () => ({ getDefaultQuery: undefined, type: DataSourceType.Alertmanager }) as unknown as DataSourceApi
  ),
  getList: jest.fn((filters?: GetDataSourceListFilters) => (filters?.variables ? [mockDS, mockVariable] : [mockDS])),
  getInstanceSettings: jest.fn(() => mockDS),
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => dsSrvMock,
}));

// The query library drawer is enterprise-only, so stand in a button per row that hands the
// staged selection to the callbacks QueryEditorRows wires up. Clicking it drives a replacement
// through the real component tree, including the row -> index mapping.
let stagedSelection: { query?: DataQuery; queries?: DataQuery[] } = {};

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({
    renderSavedQueryButtons: (options: {
      query: DataQuery;
      onSelectQuery: (query: DataQuery) => void;
      onSelectQueries?: (queries: DataQuery[]) => void;
    }) => (
      <button
        data-testid={`select-from-library-${options.query.refId}`}
        onClick={() => {
          if (stagedSelection.queries) {
            options.onSelectQueries?.(stagedSelection.queries);
          } else if (stagedSelection.query) {
            options.onSelectQuery(stagedSelection.query);
          }
        }}
      />
    ),
    renderQueryLibraryEditingHeader: () => null,
  }),
}));

/** Render the rows, then pick a single query from the library on the row with the given refId. */
async function selectQueryFromLibrary(testProps: Props, query: DataQuery, refId: string) {
  stagedSelection = { query };
  render(<QueryEditorRows {...testProps} />);
  await userEvent.click(await screen.findByTestId(`select-from-library-${refId}`));
}

/** Render the rows, then pick a multi-query entry from the library on the row with the given refId. */
async function selectQueriesFromLibrary(testProps: Props, queries: DataQuery[], refId: string) {
  stagedSelection = { queries };
  render(<QueryEditorRows {...testProps} />);
  await userEvent.click(await screen.findByTestId(`select-from-library-${refId}`));
}

const props: Props = {
  queries: [
    {
      datasource: mockDS,
      refId: 'A',
    },
    {
      datasource: mockDS,
      refId: 'B',
    },
  ],
  dsSettings: mockDataSource(),
  onQueriesChange: function (queries: DataQuery[]): void {
    throw new Error('Function not implemented.');
  },
  onAddQuery: function (query: DataQuery): void {
    throw new Error('Function not implemented.');
  },
  onRunQueries: function (): void {
    throw new Error('Function not implemented.');
  },
  onUpdateDatasources: function (datasource: DataSourceRef): void {
    throw new Error('Function not implemented.');
  },
  data: createMockPanelData(),
};

describe('QueryEditorRows', () => {
  // The picker's option list is virtualised, so it needs non-zero element sizes to render rows.
  beforeAll(() => {
    mockBoundingClientRect();
  });

  beforeEach(() => {
    stagedSelection = {};
  });

  it('Should call onQueriesChange with skipAutoImport when replacing query', async () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      onRunQueries: onRunQueriesMock,
    };

    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'new-datasource', type: 'prometheus' },
      expr: 'new query content',
    };

    await selectQueryFromLibrary(testProps, replacementQuery, 'A');

    expect(onQueriesChangeMock).toHaveBeenCalledWith(
      [
        { ...replacementQuery, refId: 'A' }, // preserves original refId
        props.queries[1], // second query unchanged
      ],
      { skipAutoImport: true }
    );
  });

  it('Should replace a single query with multiple queries in place, preserving the original refId for the first', async () => {
    const onQueriesChangeMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: jest.fn(),
      onRunQueries: onRunQueriesMock,
    };

    const replacements = [
      { refId: 'X', datasource: mockDS, expr: 'q1' },
      { refId: 'Y', datasource: mockDS, expr: 'q2' },
      { refId: 'Z', datasource: mockDS, expr: 'q3' },
    ];

    await selectQueriesFromLibrary(testProps, replacements, 'A');

    expect(onQueriesChangeMock).toHaveBeenCalledWith(
      [
        { ...replacements[0], refId: 'A' }, // first reuses the replaced query's refId
        { ...replacements[1], refId: 'C' }, // rest get fresh refIds that don't collide with B
        { ...replacements[2], refId: 'D' },
        props.queries[1], // second query (B) unchanged
      ],
      { skipAutoImport: true }
    );
    expect(onRunQueriesMock).toHaveBeenCalled();
  });

  it('Should be a no-op when replacing with an empty query list', async () => {
    const onQueriesChangeMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    await selectQueriesFromLibrary(
      {
        ...props,
        onQueriesChange: onQueriesChangeMock,
        onUpdateDatasources: jest.fn(),
        onRunQueries: onRunQueriesMock,
      },
      [],
      'A'
    );

    expect(onQueriesChangeMock).not.toHaveBeenCalled();
    expect(onRunQueriesMock).not.toHaveBeenCalled();
  });

  it('Should switch to mixed datasource when replacing with multiple queries spanning datasources', async () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      onRunQueries: jest.fn(),
      dsSettings: { ...props.dsSettings, uid: 'current-datasource' },
      queries: [{ datasource: { uid: 'current-datasource', type: 'prometheus' }, refId: 'A' }],
    };

    const replacements = [
      { refId: 'X', datasource: { uid: 'prom', type: 'prometheus' }, expr: 'q1' },
      { refId: 'Y', datasource: { uid: 'loki', type: 'loki' }, expr: 'q2' },
    ];

    await selectQueriesFromLibrary(testProps, replacements, 'A');

    expect(onUpdateDatasourcesMock).toHaveBeenCalledWith({ uid: MIXED_DATASOURCE_NAME });
  });

  it('Should call onUpdateDatasources when replacing query with different datasource creates mixed scenario', async () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      dsSettings: { ...props.dsSettings, uid: 'current-datasource' },
      queries: [
        { datasource: { uid: 'current-datasource', type: 'alertmanager' }, refId: 'A' },
        { datasource: { uid: 'current-datasource', type: 'alertmanager' }, refId: 'B' },
      ],
      onRunQueries: onRunQueriesMock,
    };

    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'different-datasource', type: 'prometheus' },
      expr: 'new query content',
    };

    await selectQueryFromLibrary(testProps, replacementQuery, 'A');

    expect(onUpdateDatasourcesMock).toHaveBeenCalledWith({
      uid: MIXED_DATASOURCE_NAME,
    });
  });

  it('Should call onUpdateDatasources when replacing query results in single different datasource', async () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      onRunQueries: onRunQueriesMock,
      dsSettings: { ...props.dsSettings, uid: 'current-datasource' },
      queries: [{ datasource: { uid: 'current-datasource', type: 'alertmanager' }, refId: 'A' }],
    };

    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'different-datasource', type: 'prometheus' },
      expr: 'new query content',
    };

    await selectQueryFromLibrary(testProps, replacementQuery, 'A');

    expect(onUpdateDatasourcesMock).toHaveBeenCalledWith({
      uid: 'different-datasource',
    });
  });

  it('Should not call onUpdateDatasources when replacing query with same datasource', async () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      onRunQueries: onRunQueriesMock,
      dsSettings: { ...props.dsSettings, uid: 'same-datasource' },
      queries: [
        { datasource: { uid: 'same-datasource', type: 'prometheus' }, refId: 'A' },
        { datasource: { uid: 'same-datasource', type: 'prometheus' }, refId: 'B' },
      ],
    };

    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'same-datasource', type: 'prometheus' },
      expr: 'new query content',
    };

    await selectQueryFromLibrary(testProps, replacementQuery, 'A');

    expect(onUpdateDatasourcesMock).not.toHaveBeenCalled();
  });

  it('Should call onUpdateDatasources with mixed datasource when replacing creates mixed scenario', async () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      onRunQueries: onRunQueriesMock,
      dsSettings: { ...props.dsSettings, uid: 'current-datasource' },
      queries: [
        { datasource: { uid: 'datasource-1', type: 'loki' }, refId: 'A' },
        { datasource: { uid: 'datasource-2', type: 'test-data' }, refId: 'B' },
      ],
    };

    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'datasource-3', type: 'prometheus' },
      expr: 'new query content',
    };

    await selectQueryFromLibrary(testProps, replacementQuery, 'A');

    expect(onUpdateDatasourcesMock).toHaveBeenCalledWith({
      uid: MIXED_DATASOURCE_NAME,
    });
  });

  it('Should render queries', async () => {
    const {
      renderResult: { rerender },
    } = renderScenario();
    expect(await screen.findAllByTestId(selectors.components.QueryEditorRows.rows)).toHaveLength(2);

    rerender(
      <QueryEditorRows
        {...props}
        queries={[
          {
            datasource: mockDS,
            refId: 'A',
          },
        ]}
      />
    );

    expect(await screen.findAllByTestId(selectors.components.QueryEditorRows.rows)).toHaveLength(1);
  });

  it('Should mark each query row with the datasource plugin boundary', async () => {
    renderScenario();

    const rowA = await screen.findByTestId(
      selectors.components.Plugins.queryEditorRow(DataSourceType.Alertmanager, 'A')
    );
    expect(rowA).toHaveAttribute('data-plugin-id', DataSourceType.Alertmanager);
    expect(
      await screen.findByTestId(selectors.components.Plugins.queryEditorRow(DataSourceType.Alertmanager, 'B'))
    ).toBeInTheDocument();
  });

  it('Should be able to expand and collapse queries', async () => {
    renderScenario();
    const queryEditorRows = await screen.findAllByTestId(selectors.components.QueryEditorRows.rows);

    for (const childQuery of queryEditorRows) {
      const toggleExpandButton = queryByLabelText(childQuery, 'Collapse query row') as HTMLElement;

      expect(toggleExpandButton).toBeInTheDocument();
      expect(toggleExpandButton.getAttribute('aria-expanded')).toBe('true');

      await userEvent.click(toggleExpandButton);

      expect(toggleExpandButton.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('Should have proper keyboard navigation for expand/collapse buttons', async () => {
    const user = userEvent.setup();
    renderScenario();
    const queryEditorRows = await screen.findAllByTestId(selectors.components.QueryEditorRows.rows);

    for (const childQuery of queryEditorRows) {
      const toggleExpandButton = queryByLabelText(childQuery, 'Collapse query row') as HTMLElement;
      act(() => toggleExpandButton.focus());
      expect(toggleExpandButton).toHaveAttribute('aria-expanded', 'true');

      // Toggle with Enter
      await user.keyboard('{Enter}');
      expect(toggleExpandButton).toHaveAttribute('aria-expanded', 'false');

      // Toggle with Space
      await user.keyboard(' ');
      expect(toggleExpandButton).toHaveAttribute('aria-expanded', 'true');
    }
  });

  it('Should be able to duplicate queries', async () => {
    const onAddQuery = jest.fn();
    const onQueryCopied = jest.fn();

    renderScenario({ onAddQuery, onQueryCopied });
    const queryEditorRows = await screen.findAllByTestId(selectors.components.QueryEditorRows.rows);
    for (const childQuery of queryEditorRows) {
      const duplicateQueryButton = queryByLabelText(childQuery, 'Duplicate query') as HTMLElement;

      expect(duplicateQueryButton).toBeInTheDocument();

      await userEvent.click(duplicateQueryButton);
    }

    expect(onAddQuery).toHaveBeenCalledTimes(queryEditorRows.length);
    expect(onQueryCopied).toHaveBeenCalledTimes(queryEditorRows.length);
  });

  it('Should be able to delete queries', async () => {
    const onQueriesChange = jest.fn();
    const onQueryRemoved = jest.fn();
    renderScenario({ onQueriesChange, onQueryRemoved });

    const queryEditorRows = await screen.findAllByTestId(selectors.components.QueryEditorRows.rows);
    for (const childQuery of queryEditorRows) {
      const deleteQueryButton = queryByLabelText(childQuery, 'Remove query') as HTMLElement;

      expect(deleteQueryButton).toBeInTheDocument();

      await userEvent.click(deleteQueryButton);
    }

    expect(onQueriesChange).toHaveBeenCalledTimes(queryEditorRows.length);
    expect(onQueryRemoved).toHaveBeenCalledTimes(queryEditorRows.length);
  });

  it('Should call getDefaultQuery when changing datasource with mixed datasource enabled', async () => {
    const user = userEvent.setup();
    const onQueriesChangeMock = jest.fn();

    const mixedDsSettings = mockDataSource(
      { name: MIXED_DATASOURCE_NAME, uid: MIXED_DATASOURCE_NAME },
      { mixed: true }
    );

    const getDefaultQuery = jest.fn(() => ({ defaultFromDS: 'yes' }));
    const promDS = mockDataSource({ uid: 'prom', name: 'Prometheus', type: 'prometheus' });
    // Mutate singleton dsSrvMock to return a datasource that has getDefaultQuery
    dsSrvMock.get = jest.fn(() => Promise.resolve({ getDefaultQuery } as unknown as DataSourceApi));
    dsSrvMock.getInstanceSettings = jest.fn(() => ({ ...mockDS, type: 'alertmanager' }));
    dsSrvMock.getList = jest.fn(() => [mockDS, promDS]);

    // A mixed group shows a datasource picker per row.
    render(<QueryEditorRows {...props} dsSettings={mixedDsSettings} onQueriesChange={onQueriesChangeMock} />);

    // Pick a different type than the existing one to trigger the default query path
    const [firstRowPicker] = await screen.findAllByTestId(selectors.components.DataSourcePicker.inputV2);
    await user.click(firstRowPicker);
    await user.click(await screen.findByText('Prometheus'));

    await waitFor(() => expect(onQueriesChangeMock).toHaveBeenCalled());

    const updatedQueries = onQueriesChangeMock.mock.calls[0][0] as Array<DataQuery & { defaultFromDS?: string }>;
    expect(updatedQueries[0].defaultFromDS).toBe('yes');
    expect(getDefaultQuery).toHaveBeenCalledTimes(1);
  });
});

function renderScenario(overrides?: Partial<Props>) {
  Object.assign(props, overrides);

  return {
    renderResult: render(<QueryEditorRows {...props} />),
  };
}
