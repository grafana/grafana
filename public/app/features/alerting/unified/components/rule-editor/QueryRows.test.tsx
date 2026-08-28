import { type PropsWithChildren } from 'react';
import { render, screen } from 'test/test-utils';

import { type DataSourceInstanceSettings } from '@grafana/data';
import * as runtimeUnstable from '@grafana/runtime/unstable';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { QueryRows } from './QueryRows';

jest.mock('./QueryWrapper', () => ({
  QueryWrapper: () => <div data-testid="query-wrapper" />,
  EmptyQueryWrapper: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

const DATASOURCE_UID = 'ds-uid';

const QUERY: AlertQuery = {
  refId: 'A',
  datasourceUid: DATASOURCE_UID,
  queryType: '',
  model: { refId: 'A' },
};

function renderQueryRows() {
  return render(
    <QueryRows
      queries={[QUERY]}
      expressions={[]}
      data={{}}
      onRunQueries={jest.fn()}
      onQueriesChange={jest.fn()}
      onDuplicateQuery={jest.fn()}
      condition={null}
      onSetCondition={jest.fn()}
    />
  );
}

describe('QueryRows', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders nothing for a row while its data source settings are loading', () => {
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({ isLoading: true });

    renderQueryRows();

    expect(screen.queryByTestId('query-wrapper')).not.toBeInTheDocument();
    expect(screen.queryByText('This datasource has been removed')).not.toBeInTheDocument();
  });

  it('shows the datasource-not-found card once loading settles with no settings resolved', () => {
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({ isLoading: false });

    renderQueryRows();

    expect(screen.getByText('This datasource has been removed')).toBeInTheDocument();
    expect(screen.queryByTestId('query-wrapper')).not.toBeInTheDocument();
  });

  it('renders the query editor once the data source settings resolve', () => {
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({
      isLoading: false,
      settings: { uid: DATASOURCE_UID, type: 'prometheus' } as unknown as DataSourceInstanceSettings,
    });

    renderQueryRows();

    expect(screen.getByTestId('query-wrapper')).toBeInTheDocument();
  });
});
