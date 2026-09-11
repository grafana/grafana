import { type PropsWithChildren } from 'react';
import { fireEvent, render, screen } from 'test/test-utils';

import { type DataSourceInstanceSettings } from '@grafana/data';
import * as runtimeUnstable from '@grafana/runtime/unstable';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { QueryRows } from './QueryRows';

const NEW_DATASOURCE_SETTINGS = { uid: 'new-uid', type: 'prometheus' } as unknown as DataSourceInstanceSettings;

jest.mock('./QueryWrapper', () => ({
  QueryWrapper: ({ onChangeDataSource }: { onChangeDataSource: (settings: DataSourceInstanceSettings) => void }) => (
    <div data-testid="query-wrapper">
      <button data-testid="change-datasource" onClick={() => onChangeDataSource(NEW_DATASOURCE_SETTINGS)} />
    </div>
  ),
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

  it('shows a retryable load error instead of the removed-datasource card when the settings lookup fails', async () => {
    const reloadSpy = jest.spyOn(runtimeUnstable, 'reloadDataSourceInstanceSettings').mockResolvedValue();
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({
      isLoading: false,
      error: new Error('backend unreachable'),
    });

    const { container, user } = renderQueryRows();

    expect(container).toHaveTextContent('Could not load datasource');
    expect(container).toHaveTextContent('backend unreachable');
    expect(screen.queryByText('This datasource has been removed')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('applies a datasource change synchronously using the already-resolved previous settings', () => {
    const onQueriesChange = jest.fn();
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({
      isLoading: false,
      settings: { uid: DATASOURCE_UID, type: 'prometheus' } as unknown as DataSourceInstanceSettings,
    });

    render(
      <QueryRows
        queries={[QUERY]}
        expressions={[]}
        data={{}}
        onRunQueries={jest.fn()}
        onQueriesChange={onQueriesChange}
        onDuplicateQuery={jest.fn()}
        condition={null}
        onSetCondition={jest.fn()}
      />
    );

    // fireEvent (unlike userEvent) does not await a microtask, so a callback that still needed to
    // fetch the previous settings would not have updated onQueriesChange by this point.
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.click(screen.getByTestId('change-datasource'));

    expect(onQueriesChange).toHaveBeenCalledTimes(1);
    const [updatedQueries] = onQueriesChange.mock.calls[0];
    expect(updatedQueries[0].datasourceUid).toBe(NEW_DATASOURCE_SETTINGS.uid);
  });
});
