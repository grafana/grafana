import { act, render, screen } from 'test/test-utils';

import { DataSourceApi, DataSourcePlugin, type DataSourcePluginMeta, type QueryEditorProps } from '@grafana/data';
import { setDataSourcePluginImporter } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';

import { mockAlertQuery, mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';

import { RecordingRuleEditor, type RecordingRuleEditorProps } from './RecordingRuleEditor';

class TestDataSource extends DataSourceApi {
  query() {
    return Promise.resolve({ data: [] });
  }
  testDatasource() {
    return Promise.resolve({ status: 'success', message: '' });
  }
}

function StubQueryEditor({ query, onChange }: QueryEditorProps<DataSourceApi, DataQuery>) {
  return (
    <input
      aria-label="Expression"
      onChange={(e) => {
        const next = { ...query, expr: e.target.value };
        onChange(next);
      }}
    />
  );
}

const prometheus = mockDataSource({ uid: 'prom-uid', name: 'Prometheus' });
const loki = mockDataSource({ uid: 'loki-uid', name: 'Loki', type: DataSourceType.Loki }, { id: DataSourceType.Loki });

// The plugin is resolved from the data source type, so all data sources of one type share a plugin.
// Each test picks how the plugin import behaves instead of using a separate plugin id.
type PluginBehavior = 'ok' | 'fails-to-load' | 'no-query-editor';
let pluginBehavior: PluginBehavior = 'ok';

async function importPlugin(_meta: DataSourcePluginMeta) {
  if (pluginBehavior === 'fails-to-load') {
    throw new Error('plugin bundle failed to load');
  }
  const plugin = new DataSourcePlugin<DataSourceApi>(TestDataSource);
  return pluginBehavior === 'no-query-editor' ? plugin : plugin.setQueryEditor(StubQueryEditor);
}

// Holds every plugin import until the test calls the returned function.
function holdPluginImport() {
  let finishImport!: () => void;
  const imported = new Promise<void>((resolve) => (finishImport = resolve));
  setDataSourcePluginImporter(async (meta) => {
    await imported;
    return importPlugin(meta);
  });
  return finishImport;
}

function renderRecordingRuleEditor(props: Partial<RecordingRuleEditorProps> = {}) {
  const dataSourceUid = props.dataSourceUid ?? prometheus.uid;
  const onChangeQuery = jest.fn();

  const view = render(
    <RecordingRuleEditor
      queries={[mockAlertQuery({ datasourceUid: dataSourceUid })]}
      onChangeQuery={onChangeQuery}
      runQueries={jest.fn()}
      panelData={{}}
      dataSourceUid={dataSourceUid}
      {...props}
    />
  );

  return { ...view, onChangeQuery };
}

beforeEach(() => {
  setupDataSources(prometheus, loki);
  setDataSourcePluginImporter(importPlugin);
  pluginBehavior = 'ok';
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RecordingRuleEditor', () => {
  it('calls onChangeQuery with the edited expression for the data source', async () => {
    const { user, onChangeQuery } = renderRecordingRuleEditor();

    await user.type(await screen.findByRole('textbox', { name: 'Expression' }), 'u');

    expect(onChangeQuery).toHaveBeenLastCalledWith([
      expect.objectContaining({
        datasourceUid: prometheus.uid,
        expr: 'u',
        model: expect.objectContaining({ expr: 'u', refId: 'A', queryType: '' }),
      }),
    ]);
  });

  it('defaults the Loki query type to instant', async () => {
    const { user, onChangeQuery } = renderRecordingRuleEditor({ dataSourceUid: loki.uid });

    await user.type(await screen.findByRole('textbox', { name: 'Expression' }), 'u');

    expect(onChangeQuery).toHaveBeenLastCalledWith([
      expect.objectContaining({
        datasourceUid: loki.uid,
        model: expect.objectContaining({ expr: 'u', queryType: 'instant' }),
      }),
    ]);
  });

  it('shows a skeleton after 300 ms of plugin loading, then replaces it with the query editor', async () => {
    jest.useFakeTimers();
    const finishImport = holdPluginImport();
    renderRecordingRuleEditor({ dataSourceUid: prometheus.uid });

    await act(() => jest.advanceTimersByTimeAsync(299));
    expect(screen.queryByTestId('recording-rule-editor-skeleton')).not.toBeInTheDocument();

    await act(() => jest.advanceTimersByTimeAsync(1));
    expect(screen.getByTestId('recording-rule-editor-skeleton')).toBeInTheDocument();

    await act(async () => finishImport());
    expect(await screen.findByRole('textbox', { name: 'Expression' })).toBeInTheDocument();
    expect(screen.queryByTestId('recording-rule-editor-skeleton')).not.toBeInTheDocument();
  });

  it.each<{ name: string; dataSourceUid: string; behavior?: PluginBehavior; reason: string }>([
    {
      name: 'the data source does not exist',
      dataSourceUid: 'unknown-uid',
      reason: 'Datasource unknown-uid was not found',
    },
    {
      name: 'the plugin fails to load',
      dataSourceUid: prometheus.uid,
      behavior: 'fails-to-load',
      reason: 'plugin bundle failed to load',
    },
    {
      name: 'the plugin has no query editor',
      dataSourceUid: prometheus.uid,
      behavior: 'no-query-editor',
      reason: 'Data source plugin does not export any Query Editor component',
    },
  ])('shows an error when $name', async ({ dataSourceUid, behavior = 'ok', reason }) => {
    pluginBehavior = behavior;
    renderRecordingRuleEditor({ dataSourceUid });

    expect(await screen.findByText(`Could not load query editor due to: ${reason}`)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Expression' })).not.toBeInTheDocument();
  });
});
