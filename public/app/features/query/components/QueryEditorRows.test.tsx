import { fireEvent, queryByLabelText, render, screen, waitFor } from '@testing-library/react';

import { DataSourceRef, type DataQuery } from '@grafana/schema';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import createMockPanelData from 'app/plugins/datasource/azuremonitor/mocks/panelData';

import { QueryEditorRows, Props } from './QueryEditorRows';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

const mockDS = mockDataSource({
  name: 'CloudManager',
  type: DataSourceType.Alertmanager,
});

const mockVariable = mockDataSource({
  name: '${dsVariable}',
  type: 'datasource',
});

const dsSrvMock: any = {
  get: jest.fn(() => Promise.resolve(mockDS)),
  getList: jest.fn(({ variables }: { variables: boolean }) => (variables ? [mockDS, mockVariable] : [mockDS])),
  getInstanceSettings: jest.fn(() => mockDS),
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => dsSrvMock,
}));

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
  it('Should call onQueriesChange with skipAutoImport when replacing query', () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
    };

    const component = new QueryEditorRows(testProps);
    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'new-datasource', type: 'prometheus' },
      expr: 'new query content',
    };

    component.onReplaceQuery(replacementQuery, 0);

    expect(onQueriesChangeMock).toHaveBeenCalledWith(
      [
        { ...replacementQuery, refId: 'A' }, // preserves original refId
        props.queries[1], // second query unchanged
      ],
      { skipAutoImport: true }
    );
  });

  it('Should render queries', async () => {
    const {
      renderResult: { rerender },
    } = renderScenario();
    expect((await screen.findByTestId('query-editor-rows')).children.length).toBe(2);

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

    expect((await screen.findByTestId('query-editor-rows')).children.length).toBe(1);
  });

  it('Should be able to expand and collapse queries', async () => {
    renderScenario();
    const queryEditorRows = await screen.findAllByTestId('query-editor-row');

    for (const childQuery of queryEditorRows) {
      const toggleExpandButton = queryByLabelText(childQuery, 'Collapse query row') as HTMLElement;

      expect(toggleExpandButton).toBeInTheDocument();
      expect(toggleExpandButton.getAttribute('aria-expanded')).toBe('true');

      fireEvent.click(toggleExpandButton);

      expect(toggleExpandButton.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('Should be able to duplicate queries', async () => {
    const onAddQuery = jest.fn();
    const onQueryCopied = jest.fn();

    renderScenario({ onAddQuery, onQueryCopied });
    const queryEditorRows = await screen.findAllByTestId('query-editor-row');
    queryEditorRows.map(async (childQuery) => {
      const duplicateQueryButton = queryByLabelText(childQuery, 'Duplicate query') as HTMLElement;

      expect(duplicateQueryButton).toBeInTheDocument();

      fireEvent.click(duplicateQueryButton);
    });

    expect(onAddQuery).toHaveBeenCalledTimes(queryEditorRows.length);
    expect(onQueryCopied).toHaveBeenCalledTimes(queryEditorRows.length);
  });

  it('Should be able to delete queries', async () => {
    const onQueriesChange = jest.fn();
    const onQueryRemoved = jest.fn();
    renderScenario({ onQueriesChange, onQueryRemoved });

    const queryEditorRows = await screen.findAllByTestId('query-editor-row');
    queryEditorRows.map(async (childQuery) => {
      const deleteQueryButton = queryByLabelText(childQuery, 'Remove query') as HTMLElement;

      expect(deleteQueryButton).toBeInTheDocument();

      fireEvent.click(deleteQueryButton);
    });

    expect(onQueriesChange).toHaveBeenCalledTimes(queryEditorRows.length);
    expect(onQueryRemoved).toHaveBeenCalledTimes(queryEditorRows.length);
  });

  it('Should call getDefaultQuery when changing datasource with mixed datasource enabled', async () => {
    const onQueriesChangeMock = jest.fn();

    const mixedDsSettings = {
      ...mockDataSource(),
      name: MIXED_DATASOURCE_NAME,
      uid: MIXED_DATASOURCE_NAME,
      meta: { ...(mockDataSource().meta || {}), mixed: true },
    } as any;

    const component = new QueryEditorRows({
      ...props,
      dsSettings: mixedDsSettings,
      onQueriesChange: onQueriesChangeMock,
    });

    const getDefaultQuery = jest.fn(() => ({ defaultFromDS: 'yes' }));
    // Mutate singleton dsSrvMock to return a datasource that has getDefaultQuery
    dsSrvMock.get = jest.fn(() => Promise.resolve({ getDefaultQuery }));
    dsSrvMock.getInstanceSettings = jest.fn(() => ({ type: 'alertmanager' }) as any);

    // Change to a different type than existing to trigger default query path
    const newDS = { uid: 'prom', name: 'Prometheus', type: 'prometheus' } as any;
    component.onDataSourceChange(newDS, 0);

    await waitFor(() => expect(onQueriesChangeMock).toHaveBeenCalled());

    const updatedQueries = onQueriesChangeMock.mock.calls[0][0] as any[];
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
