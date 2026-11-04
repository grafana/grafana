import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { DataSourceApi, DataSourcePlugin, type DataSourcePluginMeta, type QueryEditorProps } from '@grafana/data';
import { setDataSourcePluginImporter } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';

import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';

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

const NO_EDITOR_PLUGIN_ID = 'prometheus-without-editor';
const FAILING_PLUGIN_ID = 'prometheus-failing-import';

const prometheus = mockDataSource({ uid: 'prom-uid', name: 'Prometheus' });
const testData = mockDataSource({ uid: 'testdata-uid', name: 'TestData', type: 'grafana-testdata-datasource' });
const noEditor = mockDataSource({ uid: 'no-editor-uid', name: 'No editor' }, { id: NO_EDITOR_PLUGIN_ID });
const failingImport = mockDataSource({ uid: 'failing-uid', name: 'Failing' }, { id: FAILING_PLUGIN_ID });

async function importPlugin(meta: DataSourcePluginMeta) {
  if (meta.id === FAILING_PLUGIN_ID) {
    throw new Error('plugin bundle failed to load');
  }
  const plugin = new DataSourcePlugin<DataSourceApi>(TestDataSource);
  return meta.id === NO_EDITOR_PLUGIN_ID ? plugin : plugin.setQueryEditor(StubQueryEditor);
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
  setupDataSources(prometheus, testData, noEditor, failingImport);
  setDataSourcePluginImporter(importPlugin);
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

  it.each([
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
      dataSourceUid: failingImport.uid,
      reason: 'plugin bundle failed to load',
    },
    {
      name: 'the plugin has no query editor',
      dataSourceUid: noEditor.uid,
      reason: 'Data source plugin does not export any Query Editor component',
    },
  ])('shows an error when $name', async ({ dataSourceUid, reason }) => {
    renderExpressionEditor({ dataSourceUid });

    expect(await screen.findByText(`Could not load query editor due to: ${reason}`)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Expression' })).not.toBeInTheDocument();
  });
});
