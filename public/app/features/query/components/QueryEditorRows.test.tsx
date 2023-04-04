import { fireEvent, queryByLabelText, render, screen } from '@testing-library/react';
import React from 'react';

import { type DataQuery } from '@grafana/schema';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import createMockPanelData from 'app/plugins/datasource/azuremonitor/__mocks__/panelData';

import { QueryEditorRows, Props } from './QueryEditorRows';

const mockDS = mockDataSource({
  name: 'CloudManager',
  type: DataSourceType.Alertmanager,
});

const mockVariable = mockDataSource({
  name: '${dsVariable}',
  type: 'datasource',
});

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
    getDataSourceSrv: () => ({
      get: () => Promise.resolve({ ...mockDS, getRef: () => {} }),
      getList: ({ variables }: { variables: boolean }) => (variables ? [mockDS, mockVariable] : [mockDS]),
      getInstanceSettings: () => ({
        ...mockDS,
        meta: {
          ...mockDS.meta,
          alerting: true,
          mixed: true,
        },
      }),
    }),
  };
});

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
  data: createMockPanelData(),
};

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
    getDataSourceSrv: () => ({
      get: () => Promise.resolve(mockDS),
      getList: ({ variables }: { variables: boolean }) => (variables ? [mockDS, mockVariable] : [mockDS]),
      getInstanceSettings: () => mockDS,
    }),
  };
});

describe('QueryEditorRows', () => {
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
      const toggleExpandButton = queryByLabelText(childQuery, 'toggle collapse and expand query row') as HTMLElement;

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
      const duplicateQueryButton = queryByLabelText(
        childQuery,
        'Duplicate query query operation action'
      ) as HTMLElement;

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
      const deleteQueryButton = queryByLabelText(childQuery, 'Remove query query operation action') as HTMLElement;

      expect(deleteQueryButton).toBeInTheDocument();

      fireEvent.click(deleteQueryButton);
    });

    expect(onQueriesChange).toHaveBeenCalledTimes(queryEditorRows.length);
    expect(onQueryRemoved).toHaveBeenCalledTimes(queryEditorRows.length);
  });
});

function renderScenario(overrides?: Partial<Props>) {
  Object.assign(props, overrides);

  return {
    renderResult: render(<QueryEditorRows {...props} />),
  };
}
