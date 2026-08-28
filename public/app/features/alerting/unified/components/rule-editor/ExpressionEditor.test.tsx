import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';
import { useDataSourceInstance, useDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { type RuleFormValues } from '../../types/rule-form';

import { ExpressionEditor, type ExpressionEditorProps } from './ExpressionEditor';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstance: jest.fn(),
  useDataSourceInstanceSettings: jest.fn(),
}));

const mockUseDataSourceInstance = jest.mocked(useDataSourceInstance);
const mockUseDataSourceInstanceSettings = jest.mocked(useDataSourceInstanceSettings);

function renderExpressionEditor(props: Partial<ExpressionEditorProps> = {}) {
  function Wrapper() {
    const formApi = useForm<RuleFormValues>({ defaultValues: getDefaultFormValues() });
    return (
      <FormProvider {...formApi}>
        <ExpressionEditor dataSourceName="loki" onChange={jest.fn()} showPreviewAlertsButton={false} {...props} />
      </FormProvider>
    );
  }
  return render(<Wrapper />);
}

describe('ExpressionEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing while the data source is resolving', () => {
    mockUseDataSourceInstance.mockReturnValue({ isLoading: true });
    mockUseDataSourceInstanceSettings.mockReturnValue({ isLoading: true });

    const { container } = renderExpressionEditor();

    expect(container).toBeEmptyDOMElement();
  });

  it('shows an error message when the data source has no query editor', () => {
    mockUseDataSourceInstance.mockReturnValue({
      isLoading: false,
      dataSource: { name: 'loki', components: {} } as DataSourceApi,
    });
    mockUseDataSourceInstanceSettings.mockReturnValue({
      isLoading: false,
      settings: { type: 'loki' } as DataSourceInstanceSettings,
    });

    renderExpressionEditor();

    expect(screen.getByText(/could not load query editor/i)).toBeInTheDocument();
  });

  it('renders the plugin query editor once the data source has resolved', () => {
    const QueryEditor = () => <div data-testid="plugin-query-editor" />;
    mockUseDataSourceInstance.mockReturnValue({
      isLoading: false,
      dataSource: { name: 'loki', components: { QueryEditor } } as unknown as DataSourceApi,
    });
    mockUseDataSourceInstanceSettings.mockReturnValue({
      isLoading: false,
      settings: { type: 'loki' } as DataSourceInstanceSettings,
    });

    renderExpressionEditor();

    expect(screen.getByTestId('plugin-query-editor')).toBeInTheDocument();
  });
});
