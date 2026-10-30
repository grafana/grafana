import { render, screen } from 'test/test-utils';

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

const NO_EDITOR_PLUGIN_ID = 'prometheus-without-editor';
const FAILING_PLUGIN_ID = 'prometheus-failing-import';

const prometheus = mockDataSource({ uid: 'prom-uid', name: 'Prometheus' });
const loki = mockDataSource({ uid: 'loki-uid', name: 'Loki', type: DataSourceType.Loki }, { id: DataSourceType.Loki });
const noEditor = mockDataSource({ uid: 'no-editor-uid', name: 'No editor' }, { id: NO_EDITOR_PLUGIN_ID });
const failingImport = mockDataSource({ uid: 'failing-uid', name: 'Failing' }, { id: FAILING_PLUGIN_ID });

async function importPlugin(meta: DataSourcePluginMeta) {
  if (meta.id === FAILING_PLUGIN_ID) {
    throw new Error('plugin bundle failed to load');
  }
  const plugin = new DataSourcePlugin<DataSourceApi>(TestDataSource);
  return meta.id === NO_EDITOR_PLUGIN_ID ? plugin : plugin.setQueryEditor(StubQueryEditor);
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
  setupDataSources(prometheus, loki, noEditor, failingImport);
  setDataSourcePluginImporter(importPlugin);
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

  it.each([
    {
      name: 'the data source does not exist',
      dataSourceUid: 'unknown-uid',
      reason: 'Datasource unknown-uid was not found',
    },
    {
      name: 'the plugin fails to load',
      dataSourceUid: failingImport.uid,
      reason: 'plugin bundle failed to load',
    },
    {
      name: 'the plugin has no query editor',
      dataSourceUid: noEditor.uid,
      reason: 'Data source plugin does not export any Query Editor component',
    },
  ])('shows an error when $name', async ({ dataSourceUid, reason }) => {
    renderRecordingRuleEditor({ dataSourceUid });

    expect(await screen.findByText(`Could not load query editor due to: ${reason}`)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Expression' })).not.toBeInTheDocument();
  });
});
