import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { DataSourceApi, DataSourcePlugin, type DataSourcePluginMeta, type QueryEditorProps } from '@grafana/data';
import { setDataSourcePluginImporter } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';

import { setupDataSources } from '../../testSetup/datasources';
import { mockDataSource } from '../../testSetup/mockDataSource';

import { ExpressionEditor, type ExpressionEditorProps } from './ExpressionEditor';

class TestDataSource extends DataSourceApi {
  query() {
    return Promise.resolve({ data: [] });
  }
  testDatasource() {
    return Promise.resolve({ status: 'success', message: '' });
  }
}

function StubQueryEditor({ query, onChange }: QueryEditorProps<DataSourceApi, DataQuery>) {
  const expr = 'expr' in query && typeof query.expr === 'string' ? query.expr : '';
  return (
    <input
      aria-label="Expression"
      value={expr}
      onChange={(e) => {
        const next = { ...query, expr: e.target.value };
        onChange(next);
      }}
    />
  );
}

const prometheus = mockDataSource({ uid: 'prom-uid', name: 'Prometheus' });
const testData = mockDataSource({ uid: 'testdata-uid', name: 'TestData', type: 'grafana-testdata-datasource' });

// The plugin is resolved from the data source type, and every fixture above shares one type per
// plugin. So each test picks how the plugin import behaves instead of using a separate plugin id.
type PluginBehavior = 'ok' | 'fails-to-load' | 'no-query-editor';
let pluginBehavior: PluginBehavior = 'ok';

async function importPlugin(_meta: DataSourcePluginMeta) {
  if (pluginBehavior === 'fails-to-load') {
    throw new Error('plugin bundle failed to load');
  }
  const plugin = new DataSourcePlugin<DataSourceApi>(TestDataSource);
  return pluginBehavior === 'no-query-editor' ? plugin : plugin.setQueryEditor(StubQueryEditor);
}

function renderExpressionEditor(props: Partial<ExpressionEditorProps> = {}) {
  const onChange = jest.fn();

  function Wrapper() {
    const formApi = useForm();
    return (
      <FormProvider {...formApi}>
        <ExpressionEditor
          value="up"
          onChange={onChange}
          dataSourceUid={prometheus.uid}
          showPreviewAlertsButton={true}
          {...props}
        />
      </FormProvider>
    );
  }

  return { ...render(<Wrapper />), onChange };
}

beforeEach(() => {
  setupDataSources(prometheus, testData);
  setDataSourcePluginImporter(importPlugin);
  pluginBehavior = 'ok';
});

describe('ExpressionEditor', () => {
  it('renders the data source query editor with the current expression', async () => {
    renderExpressionEditor();

    expect(await screen.findByRole('textbox', { name: 'Expression' })).toHaveValue('up');
    expect(screen.getByRole('button', { name: 'Preview alerts' })).toBeInTheDocument();
  });

  it('calls onChange with the edited expression', async () => {
    const { user, onChange } = renderExpressionEditor();

    await user.type(await screen.findByRole('textbox', { name: 'Expression' }), '!');

    expect(onChange).toHaveBeenLastCalledWith('up!');
  });

  it('hides the preview button when showPreviewAlertsButton is false', async () => {
    renderExpressionEditor({ showPreviewAlertsButton: false });

    expect(await screen.findByRole('textbox', { name: 'Expression' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview alerts' })).not.toBeInTheDocument();
  });

  it.each<{ name: string; dataSourceUid: string; behavior?: PluginBehavior; reason: string }>([
    {
      name: 'the data source does not exist',
      dataSourceUid: 'unknown-uid',
      reason: 'Datasource unknown-uid not found',
    },
    {
      name: 'the data source type is not supported',
      dataSourceUid: testData.uid,
      reason: 'grafana-testdata-datasource is not supported as an expression editor',
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
    renderExpressionEditor({ dataSourceUid });

    expect(await screen.findByText(`Could not load query editor due to: ${reason}`)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Expression' })).not.toBeInTheDocument();
  });
});
