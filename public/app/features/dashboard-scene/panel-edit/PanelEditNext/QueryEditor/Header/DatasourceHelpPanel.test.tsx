import { screen } from '@testing-library/react';

import { type DataSourceApi, type QueryEditorHelpProps } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { renderWithQueryEditorProvider } from '../testUtils';

import { DatasourceHelpPanel } from './DatasourceHelpPanel';

function QueryEditorHelp({ query, onClickExample }: QueryEditorHelpProps<DataQuery>) {
  return (
    <button onClick={() => onClickExample({ refId: 'example', datasource: query.datasource })}>
      Help for {query.refId}
    </button>
  );
}

const datasource = { components: { QueryEditorHelp } } as unknown as DataSourceApi;

describe('DatasourceHelpPanel', () => {
  it("shows the target query's help without waiting for the selected query's data source", () => {
    renderWithQueryEditorProvider(
      <DatasourceHelpPanel target={{ query: { refId: 'B' }, dsData: { datasource }, dsLoading: false }} />,
      {
        selectedQuery: { refId: 'B' },
        uiStateOverrides: { selectedQueryDsLoading: true, selectedQueryDsData: null },
      }
    );

    expect(screen.getByRole('button', { name: 'Help for B' })).toBeInTheDocument();
  });

  it('applies a clicked example to the target query and closes the help', async () => {
    const updateSelectedQuery = jest.fn();
    const toggleDatasourceHelp = jest.fn();
    const query = { refId: 'B', datasource: { uid: 'test', type: 'test' } };

    const { user } = renderWithQueryEditorProvider(
      <DatasourceHelpPanel target={{ query, dsData: { datasource }, dsLoading: false }} />,
      {
        selectedQuery: query,
        uiStateOverrides: { toggleDatasourceHelp },
        actionsOverrides: { updateSelectedQuery },
      }
    );

    await user.click(screen.getByRole('button', { name: 'Help for B' }));

    expect(updateSelectedQuery).toHaveBeenCalledWith({ refId: 'B', datasource: query.datasource }, 'B');
    expect(toggleDatasourceHelp).toHaveBeenCalledTimes(1);
  });

  it('falls back to the selected query when no target is given', () => {
    renderWithQueryEditorProvider(<DatasourceHelpPanel />, {
      selectedQuery: { refId: 'A' },
      uiStateOverrides: { selectedQueryDsData: { datasource } },
    });

    expect(screen.getByRole('button', { name: 'Help for A' })).toBeInTheDocument();
  });
});
