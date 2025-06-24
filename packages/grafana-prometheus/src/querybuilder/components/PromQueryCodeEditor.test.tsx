// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryCodeEditor.test.tsx
import { render, screen } from '@testing-library/react';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PrometheusLanguageProviderInterface } from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';

import { EXPLAIN_LABEL_FILTER_CONTENT } from './PromQueryBuilderExplained';
import { PromQueryCodeEditor } from './PromQueryCodeEditor';

jest.mock('../../components/monaco-query-field/MonacoQueryFieldWrapper', () => {
  const fakeQueryField = () => <div>prometheus query field</div>;
  return { MonacoQueryFieldWrapper: fakeQueryField };
});

function createDatasource() {
  const languageProvider = new EmptyLanguageProviderMock() as unknown as PrometheusLanguageProviderInterface;
  const datasource = new PrometheusDatasource(
    {
      url: '',
      jsonData: {},
      meta: {} as DataSourcePluginMeta,
    } as DataSourceInstanceSettings,
    undefined,
    languageProvider
  );
  return { datasource, languageProvider };
}

function createProps(datasource: PrometheusDatasource) {
  return {
    datasource,
    onRunQuery: () => {},
    onChange: () => {},
    showExplain: false,
  };
}

describe('PromQueryCodeEditor', () => {
  it('shows explain section when showExplain is true', async () => {
    const { datasource } = createDatasource();
    const props = createProps(datasource);
    props.showExplain = true;
    render(<PromQueryCodeEditor {...props} query={{ expr: '', refId: 'refid', interval: '1s' }} />);

    // wait for component to render
    await screen.findByRole('button');

    expect(screen.getByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
  });

  it('does not show explain section when showExplain is false', async () => {
    const { datasource } = createDatasource();
    const props = createProps(datasource);
    render(<PromQueryCodeEditor {...props} query={{ expr: '', refId: 'refid', interval: '1s' }} />);

    // wait for component to render
    await screen.findByRole('button');

    expect(screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
  });
});
