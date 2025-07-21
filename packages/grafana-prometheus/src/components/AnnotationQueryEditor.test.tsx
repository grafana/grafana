// Core Grafana testing pattern
import { fireEvent, render, screen } from '@testing-library/react';

import { AnnotationQuery } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { PrometheusDatasource } from '../datasource';
import { PrometheusLanguageProviderInterface } from '../language_provider';
import { EmptyLanguageProviderMock } from '../language_provider.mock';
import { PromQuery } from '../types';

import { AnnotationQueryEditor } from './AnnotationQueryEditor';

// Mock the PromQueryCodeEditor to avoid errors related to PromQueryField rendering
jest.mock('../querybuilder/components/PromQueryCodeEditor', () => ({
  PromQueryCodeEditor: () => <div data-testid="mock-prom-code-editor">Query Editor</div>,
}));

describe('AnnotationQueryEditor', () => {
  const mockOnChange = jest.fn();
  const mockOnAnnotationChange = jest.fn();
  const mockOnRunQuery = jest.fn();

  const mockQuery: PromQuery = {
    refId: 'test',
    expr: 'test_metric',
    interval: '',
    exemplar: true,
    instant: false,
    range: true,
  };

  const mockAnnotation: AnnotationQuery<PromQuery> = {
    name: 'Test annotation',
    enable: true,
    iconColor: 'red',
    datasource: {
      type: 'prometheus',
      uid: 'test',
    },
    target: mockQuery,
    hide: false,
    titleFormat: '{{alertname}}',
    textFormat: '{{instance}}',
    tagKeys: 'label1,label2',
    useValueForTime: false,
  };

  function createMockDatasource() {
    const languageProvider = new EmptyLanguageProviderMock() as unknown as PrometheusLanguageProviderInterface;
    const mockDatasource = {
      languageProvider,
      lookupsDisabled: false,
      modifyQuery: jest.fn().mockImplementation((query) => query),
      getQueryHints: jest.fn().mockReturnValue([]),
    } as unknown as PrometheusDatasource;

    return mockDatasource;
  }

  const defaultProps = {
    query: mockQuery,
    onChange: mockOnChange,
    onRunQuery: mockOnRunQuery,
    annotation: mockAnnotation,
    onAnnotationChange: mockOnAnnotationChange,
    datasource: createMockDatasource(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without error', () => {
    render(<AnnotationQueryEditor {...defaultProps} />);
    expect(screen.getByText('Min step')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Series value as timestamp')).toBeInTheDocument();
    expect(screen.getByTestId('mock-prom-code-editor')).toBeInTheDocument();
  });

  it('displays an error message when annotation data is missing', () => {
    render(<AnnotationQueryEditor {...defaultProps} annotation={undefined} />);
    expect(screen.getByText('Annotation data load error!')).toBeInTheDocument();
  });

  it('displays an error message when onAnnotationChange is missing', () => {
    render(<AnnotationQueryEditor {...defaultProps} onAnnotationChange={undefined} />);
    expect(screen.getByText('Annotation data load error!')).toBeInTheDocument();
  });

  it('renders correctly with an empty annotation object', () => {
    render(<AnnotationQueryEditor {...defaultProps} annotation={{} as AnnotationQuery<PromQuery>} />);
    // Should render normally with empty values but not show an error
    expect(screen.getByText('Min step')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.queryByText('Annotation data load error!')).not.toBeInTheDocument();
  });

  it('calls onChange when min step is updated', () => {
    render(<AnnotationQueryEditor {...defaultProps} />);
    const minStepInput = screen.getByLabelText('Set lower limit for the step parameter');

    // Instead of typing character by character, use a direct value change
    fireEvent.change(minStepInput, { target: { value: '10s' } });
    fireEvent.blur(minStepInput);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockQuery,
      interval: '10s',
    });
  });

  it('calls onAnnotationChange when title format is updated', () => {
    render(<AnnotationQueryEditor {...defaultProps} />);
    const titleInput = screen.getByTestId(selectors.components.DataSource.Prometheus.annotations.title);

    fireEvent.change(titleInput, { target: { value: '{{job}}' } });
    fireEvent.blur(titleInput);

    expect(mockOnAnnotationChange).toHaveBeenCalledWith({
      ...mockAnnotation,
      titleFormat: '{{job}}',
    });
  });

  it('calls onAnnotationChange when tags are updated', () => {
    render(<AnnotationQueryEditor {...defaultProps} />);
    const tagsInput = screen.getByTestId(selectors.components.DataSource.Prometheus.annotations.tags);

    fireEvent.change(tagsInput, { target: { value: 'job,instance' } });
    fireEvent.blur(tagsInput);

    expect(mockOnAnnotationChange).toHaveBeenCalledWith({
      ...mockAnnotation,
      tagKeys: 'job,instance',
    });
  });

  it('calls onAnnotationChange when text format is updated', () => {
    render(<AnnotationQueryEditor {...defaultProps} />);
    const textInput = screen.getByTestId(selectors.components.DataSource.Prometheus.annotations.text);

    fireEvent.change(textInput, { target: { value: '{{metric}}' } });
    fireEvent.blur(textInput);

    expect(mockOnAnnotationChange).toHaveBeenCalledWith({
      ...mockAnnotation,
      textFormat: '{{metric}}',
    });
  });

  it('calls onAnnotationChange when series value as timestamp is toggled', () => {
    render(<AnnotationQueryEditor {...defaultProps} />);
    const toggle = screen.getByTestId(selectors.components.DataSource.Prometheus.annotations.seriesValueAsTimestamp);
    fireEvent.click(toggle);

    expect(mockOnAnnotationChange).toHaveBeenCalledWith({
      ...mockAnnotation,
      useValueForTime: true,
    });
  });
});
