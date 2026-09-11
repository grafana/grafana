import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';
import * as runtimeUnstable from '@grafana/runtime/unstable';

import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { type RuleFormValues } from '../../types/rule-form';

import { ExpressionEditor, type ExpressionEditorProps } from './ExpressionEditor';

const DATASOURCE_NAME = 'My Prometheus';
const DATASOURCE_UID = 'prom-uid';

function FormWrapper(props: ExpressionEditorProps) {
  const formApi = useForm<RuleFormValues>({ defaultValues: getDefaultFormValues() });

  return (
    <FormProvider {...formApi}>
      <ExpressionEditor {...props} />
    </FormProvider>
  );
}

function renderEditor(props: Partial<ExpressionEditorProps> = {}) {
  return render(
    <FormWrapper
      value="up"
      onChange={jest.fn()}
      dataSourceName={DATASOURCE_NAME}
      showPreviewAlertsButton={false}
      {...props}
    />
  );
}

describe('ExpressionEditor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders nothing while the data source instance or its settings are loading', () => {
    jest.spyOn(runtimeUnstable, 'useDataSourceInstance').mockReturnValue({ isLoading: true });
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({ isLoading: true });

    const { container } = renderEditor();

    expect(container).toBeEmptyDOMElement();
  });

  it('shows an error message when the data source type is not supported as an expression editor', () => {
    jest.spyOn(runtimeUnstable, 'useDataSourceInstance').mockReturnValue({
      isLoading: false,
      dataSource: {
        name: DATASOURCE_NAME,
        uid: DATASOURCE_UID,
        type: 'elasticsearch',
        components: { QueryEditor: () => null },
      } as unknown as DataSourceApi,
    });
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({
      isLoading: false,
      settings: {
        name: DATASOURCE_NAME,
        uid: DATASOURCE_UID,
        type: 'elasticsearch',
      } as unknown as DataSourceInstanceSettings,
    });

    const { container } = renderEditor();

    expect(container).toHaveTextContent('elasticsearch is not supported as an expression editor');
  });

  it('renders the query editor with the current expression once the data source resolves', () => {
    const QueryEditor = jest.fn((_props: Record<string, unknown>) => <div data-testid="query-editor" />);
    jest.spyOn(runtimeUnstable, 'useDataSourceInstance').mockReturnValue({
      isLoading: false,
      dataSource: {
        name: DATASOURCE_NAME,
        uid: DATASOURCE_UID,
        type: 'prometheus',
        components: { QueryEditor },
      } as unknown as DataSourceApi,
    });
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({
      isLoading: false,
      settings: {
        name: DATASOURCE_NAME,
        uid: DATASOURCE_UID,
        type: 'prometheus',
      } as unknown as DataSourceInstanceSettings,
    });

    renderEditor({ value: 'up == 1' });

    expect(screen.getByTestId('query-editor')).toBeInTheDocument();
    const [props] = QueryEditor.mock.calls[0];
    expect(props).toMatchObject({ query: { refId: 'A', hide: false, expr: 'up == 1' } });
  });
});
