import { type PropsWithChildren } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';

import { DataSourceApi, DataSourcePlugin, type QueryEditorProps } from '@grafana/data';
import { setPluginLinksHook } from '@grafana/runtime';
import { setDataSourcePluginImporter } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';

import { QueryRows } from './QueryRows';

setPluginLinksHook(() => ({ links: [], isLoading: false }));

class TestDataSource extends DataSourceApi {
  query() {
    return Promise.resolve({ data: [] });
  }
  testDatasource() {
    return Promise.resolve({ status: 'success', message: '' });
  }
}

function StubQueryEditor({ query }: QueryEditorProps<DataSourceApi, DataQuery>) {
  return <div>Query editor for {query.refId}</div>;
}

const prometheus = mockDataSource({ uid: 'prom-uid', name: 'Prometheus', isDefault: true }, { alerting: true });
const otherPrometheus = mockDataSource({ uid: 'prom-2-uid', name: 'Other Prometheus' }, { alerting: true });
const loki = mockDataSource({ uid: 'loki-uid', name: 'Loki', type: 'loki' }, { alerting: true });
const nonAlertingDefault = mockDataSource(
  { uid: 'zipkin-uid', name: 'Zipkin', type: 'zipkin', isDefault: true },
  { alerting: false, tracing: true }
);

function dataQuery(datasourceUid: string, model: { expr?: string } = {}): AlertQuery {
  return {
    refId: 'A',
    datasourceUid,
    queryType: '',
    relativeTimeRange: { from: 600, to: 0 },
    model: { refId: 'A', ...model },
  };
}

function FormWrapper({ children }: PropsWithChildren) {
  const formApi = useForm();
  return <FormProvider {...formApi}>{children}</FormProvider>;
}

function renderQueryRows(queries: AlertQuery[]) {
  const onQueriesChange = jest.fn();
  const view = render(
    <FormWrapper>
      <QueryRows
        queries={queries}
        expressions={[]}
        data={{}}
        onRunQueries={jest.fn()}
        onQueriesChange={onQueriesChange}
        onDuplicateQuery={jest.fn()}
        condition={null}
        onSetCondition={jest.fn()}
      />
    </FormWrapper>
  );
  return { ...view, onQueriesChange };
}

beforeAll(() => {
  mockBoundingClientRect();
});

beforeEach(() => {
  setupDataSources(prometheus, otherPrometheus, loki);
  setDataSourcePluginImporter(async () =>
    new DataSourcePlugin<DataSourceApi>(TestDataSource).setQueryEditor(StubQueryEditor)
  );
});

describe('QueryRows', () => {
  it('renders the query editor for a query whose data source exists', async () => {
    renderQueryRows([dataQuery(prometheus.uid)]);

    expect(await screen.findByText('Query editor for A')).toBeInTheDocument();
    expect(screen.queryByText('This datasource has been removed')).not.toBeInTheDocument();
  });

  it('shows the not-found card for a query whose data source does not exist', async () => {
    renderQueryRows([dataQuery('unknown-uid')]);

    expect(await screen.findByText('This datasource has been removed')).toBeInTheDocument();
    expect(screen.queryByText('Query editor for A')).not.toBeInTheDocument();
  });

  it('removes the query when "Remove query" is clicked on the not-found card', async () => {
    const other = { ...dataQuery(prometheus.uid), refId: 'B', model: { refId: 'B' } };
    const { user, onQueriesChange } = renderQueryRows([dataQuery('unknown-uid'), other]);

    await user.click(await screen.findByRole('button', { name: 'Remove query' }));

    expect(onQueriesChange).toHaveBeenCalledWith([other]);
  });

  it.each([
    {
      name: 'the org default, which supports alerting',
      dataSources: [prometheus, otherPrometheus, loki],
      expectedRef: { type: 'prometheus', uid: 'prom-uid' },
    },
    {
      name: 'the first alerting data source, because the org default does not support alerting',
      dataSources: [nonAlertingDefault, loki],
      expectedRef: { type: 'loki', uid: 'loki-uid' },
    },
  ])(
    'clicking "Update datasource" switches the query to a new model on $name',
    async ({ dataSources, expectedRef }) => {
      setupDataSources(...dataSources);
      const { user, onQueriesChange } = renderQueryRows([dataQuery('unknown-uid', { expr: 'up' })]);

      const updateButton = await screen.findByRole('button', { name: 'Update datasource' });
      await waitFor(() => expect(updateButton).toBeEnabled());
      await user.click(updateButton);

      expect(onQueriesChange).toHaveBeenCalledWith([
        {
          refId: 'A',
          queryType: '',
          relativeTimeRange: { from: 600, to: 0 },
          datasourceUid: expectedRef.uid,
          model: { refId: 'A', hide: false, datasource: expectedRef },
        },
      ]);
    }
  );

  it('disables "Update datasource" when no data source supports alerting', async () => {
    setupDataSources(nonAlertingDefault);
    renderQueryRows([dataQuery('unknown-uid')]);

    expect(await screen.findByText('This datasource has been removed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update datasource' })).toBeDisabled();
  });

  it('keeps the query model when the data source changes to one of the same type', async () => {
    const { user, onQueriesChange } = renderQueryRows([dataQuery(prometheus.uid, { expr: 'up' })]);

    await selectDataSource(user, 'Other Prometheus');

    expect(onQueriesChange).toHaveBeenCalledWith([
      {
        refId: 'A',
        queryType: '',
        relativeTimeRange: { from: 600, to: 0 },
        datasourceUid: 'prom-2-uid',
        model: { refId: 'A', expr: 'up', datasource: { type: 'prometheus', uid: 'prom-2-uid' } },
      },
    ]);
  });

  it('resets the query model when the data source changes to one of another type', async () => {
    const { user, onQueriesChange } = renderQueryRows([dataQuery(prometheus.uid, { expr: 'up' })]);

    await selectDataSource(user, 'Loki');

    expect(onQueriesChange).toHaveBeenCalledWith([
      {
        refId: 'A',
        queryType: '',
        relativeTimeRange: { from: 600, to: 0 },
        datasourceUid: 'loki-uid',
        model: { refId: 'A', hide: false, instant: true, datasource: { type: 'loki', uid: 'loki-uid' } },
      },
    ]);
  });
});

async function selectDataSource(user: ReturnType<typeof render>['user'], name: string) {
  await screen.findByText('Query editor for A');
  await user.click(screen.getByRole('combobox', { name: /select a data source/i }));
  await user.click(await screen.findByText(name));
}
