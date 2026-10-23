import { render, screen } from '@testing-library/react';

import {
  type ComponentTypeWithExtensionMeta,
  type DataQueryError,
  type DataSourceInstanceSettings,
  type PluginExtensionQueryErrorActionV1Context,
  PluginExtensionTypes,
} from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { QueryErrorAlert } from './QueryErrorAlert';

const mockUseAssistant = jest.fn().mockReturnValue({ isLoading: false, isAvailable: true });

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => mockUseAssistant(),
  useProvidePageContext: jest.fn(),
  OpenAssistantButton: ({ title }: { title: string }) => <button>{title}</button>,
  createAssistantContextItem: jest.fn((type: string, params: { title: string; data: unknown }) => ({
    type,
    ...params,
  })),
}));

describe('QueryErrorAlert', () => {
  beforeEach(() => {
    mockUseAssistant.mockReturnValue({ isLoading: false, isAvailable: true });
    setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  });

  const dataSource: DataSourceInstanceSettings = {
    uid: 'ds-uid',
    type: 'prometheus',
    name: 'Prometheus',
    readOnly: false,
    access: 'proxy',
    jsonData: {},
  };

  type ActionContext = Partial<PluginExtensionQueryErrorActionV1Context>;
  type ActionComponent = React.ComponentType<ActionContext>;

  function createAction(id: string, Component: ActionComponent): ComponentTypeWithExtensionMeta<ActionContext> {
    return Object.assign(Component, {
      meta: {
        id,
        pluginId: 'grafana-adaptive-metrics-app',
        title: 'Fix query',
        description: '',
        type: PluginExtensionTypes.component as const,
      },
    });
  }

  it('should not render the assistant button when assistant is not available', () => {
    mockUseAssistant.mockReturnValue({ isLoading: false, isAvailable: false });

    const error: DataQueryError = { message: 'Some error' };

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByText('Some error')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fix with Assistant' })).not.toBeInTheDocument();
  });

  it('should render the error message', () => {
    const error: DataQueryError = { message: 'Something went wrong' };

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should fall back to data.message when message is not set', () => {
    const error: DataQueryError = { data: { message: 'Data level error' } };

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByText('Data level error')).toBeInTheDocument();
  });

  it('should show default message when no message is available', () => {
    const error: DataQueryError = {};

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByText('Query error')).toBeInTheDocument();
  });

  it('should render the trace ID when present', () => {
    const error: DataQueryError = { message: 'Error', traceId: 'abc123' };

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it('should render the Fix with Assistant button', () => {
    const error: DataQueryError = { message: 'Some error' };

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByRole('button', { name: 'Fix with Assistant' })).toBeInTheDocument();
  });

  it('should pass original query to assistant context when provided', () => {
    const { createAssistantContextItem } = jest.requireMock('@grafana/assistant');
    createAssistantContextItem.mockClear();

    const error: DataQueryError = { message: 'Error' };
    const query: DataQuery = { refId: 'A' };

    render(<QueryErrorAlert error={error} query={query} />);

    expect(createAssistantContextItem).toHaveBeenCalledWith('structured', {
      title: 'Original query',
      data: query,
    });
  });

  it('should not pass query context when query is not provided', () => {
    const { createAssistantContextItem } = jest.requireMock('@grafana/assistant');
    createAssistantContextItem.mockClear();

    const error: DataQueryError = { message: 'Error' };

    render(<QueryErrorAlert error={error} />);

    // Should only be called once for the error details, not for the query
    expect(createAssistantContextItem).toHaveBeenCalledTimes(1);
    expect(createAssistantContextItem).toHaveBeenCalledWith(
      'structured',
      expect.objectContaining({ title: 'Query error details' })
    );
  });

  it('should render a plugin action below the error with the error context', () => {
    const received: ActionContext[] = [];
    setPluginComponentsHook(() => ({
      components: [
        createAction('action', (props) => {
          received.push(props);
          return <button>Fix query</button>;
        }),
      ],
      isLoading: false,
    }));

    const error: DataQueryError = { message: 'Some error' };
    const query: DataQuery = { refId: 'A' };

    render(<QueryErrorAlert error={error} query={query} dataSource={dataSource} app="explore" />);

    const message = screen.getByText('Some error');
    const button = screen.getByRole('button', { name: 'Fix query' });
    expect(message.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      error: { message: 'Some error' },
      query: { refId: 'A' },
      dataSource: { uid: 'ds-uid', type: 'prometheus', name: 'Prometheus' },
      app: 'explore',
    });
  });

  it('should omit the datasource and app when they are not provided', () => {
    const received: ActionContext[] = [];
    setPluginComponentsHook(() => ({
      components: [
        createAction('action', (props) => {
          received.push(props);
          return null;
        }),
      ],
      isLoading: false,
    }));

    render(<QueryErrorAlert error={{ message: 'Some error' }} />);

    expect(received[0].dataSource).toBeUndefined();
    expect(received[0].app).toBeUndefined();
  });

  it('should render nothing for the extension point while it is loading', () => {
    setPluginComponentsHook(() => ({
      components: [createAction('action', () => <button>Fix query</button>)],
      isLoading: true,
    }));

    render(<QueryErrorAlert error={{ message: 'Some error' }} />);

    expect(screen.queryByRole('button', { name: 'Fix query' })).not.toBeInTheDocument();
  });
});
