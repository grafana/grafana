import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { cloneDeep, defaultsDeep } from 'lodash';

import { PluginMeta, PluginType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';

import { CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT } from '../../components/monaco-query-field/monaco-completion-provider/data_provider';
import { PromQueryEditorProps } from '../../components/types';
import { PrometheusDatasource } from '../../datasource';
import { PrometheusLanguageProviderInterface } from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { PromQuery } from '../../types';
import { QueryEditorMode } from '../shared/types';

import { PromQueryEditorSelector } from './PromQueryEditorSelector';

beforeEach(() => {
  jest.replaceProperty(config, 'featureToggles', {
    prometheusCodeModeMetricNamesSearch: true,
  });
});

// We need to mock this because it seems jest has problem importing monaco in tests
jest.mock('../../components/monaco-query-field/MonacoQueryFieldWrapper', () => {
  return {
    MonacoQueryFieldWrapper: () => {
      return 'MonacoQueryFieldWrapper';
    },
  };
});

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});

const defaultQuery = {
  refId: 'A',
  expr: 'metric{label1="foo", label2="bar"}',
};

const defaultMeta: PluginMeta = {
  id: '',
  name: '',
  type: PluginType.datasource,
  info: {
    author: {
      name: 'tester',
    },
    description: 'testing',
    links: [],
    logos: {
      large: '',
      small: '',
    },
    screenshots: [],
    updated: '',
    version: '',
  },
  module: '',
  baseUrl: '',
};

const getDefaultDatasource = (jsonDataOverrides = {}) =>
  new PrometheusDatasource(
    {
      id: 1,
      uid: 'myDataSourceUid',
      type: 'prometheus',
      name: 'prom-test',
      access: 'proxy',
      url: '',
      jsonData: jsonDataOverrides,
      meta: defaultMeta,
      readOnly: false,
    },
    undefined,
    new EmptyLanguageProviderMock() as unknown as PrometheusLanguageProviderInterface
  );

const defaultProps = {
  datasource: getDefaultDatasource(),
  query: defaultQuery,
  onRunQuery: () => {},
  onChange: () => {},
};

const autocompleteInfoSelector = selectors.components.DataSource.Prometheus.queryEditor.code.metricsCountInfo;

describe('PromQueryEditorSelector', () => {
  it('does not show autocomplete info when the code editor first displays', async () => {
    const { queryByTestId } = renderWithCodeMode();
    expect(await screen.findByText('MonacoQueryFieldWrapper')).toBeInTheDocument();
    expect(queryByTestId(autocompleteInfoSelector)).not.toBeInTheDocument();
  });

  it('shows autocomplete info when the expected event fires', async () => {
    const { findByTestId } = renderWithCodeMode();
    fireEvent(
      window,
      createEvent(
        CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT,
        window,
        {
          detail: { limit: 100, datasourceUid: 'myDataSourceUid' },
        },
        { EventType: 'CustomEvent' }
      )
    );
    expect(await screen.findByText('MonacoQueryFieldWrapper')).toBeInTheDocument();
    const autocompleteInfo = await findByTestId(autocompleteInfoSelector);
    expect(autocompleteInfo).toBeInTheDocument();
  });

  it('does not show autocomplete info when the triggering event refers to a different data source', async () => {
    const { queryByTestId } = renderWithCodeMode();
    fireEvent(
      window,
      createEvent(
        CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT,
        window,
        {
          detail: { limit: 100, datasourceUid: 'theWrongUid' },
        },
        { EventType: 'CustomEvent' }
      )
    );
    expect(await screen.findByText('MonacoQueryFieldWrapper')).toBeInTheDocument();
    const autocompleteInfo = await queryByTestId(autocompleteInfoSelector);
    expect(autocompleteInfo).not.toBeInTheDocument();
  });
});

function renderWithCodeMode() {
  return renderWithProps({ editorMode: QueryEditorMode.Code, expr: 'my_metric' });
}

function renderWithProps(overrides?: Partial<PromQuery>, componentProps: Partial<PromQueryEditorProps> = {}) {
  const query = defaultsDeep(overrides ?? {}, cloneDeep(defaultQuery));
  const onChange = jest.fn();

  const allProps = { ...defaultProps, ...componentProps };
  const stuff = render(<PromQueryEditorSelector {...allProps} query={query} onChange={onChange} />);
  return { onChange, ...stuff };
}
