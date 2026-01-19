import { render, screen } from '@testing-library/react';

import { AssistantHook, useAssistant } from '@grafana/assistant';
import { CoreApp, DataSourceInstanceSettings } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { QueryActionAssistantButton } from './QueryActionAssistantButton';
// Mock the assistant hook
jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn(),
}));

// Mock the runtime services that assistant depends on
const mockConfig = {
  featureToggles: {
    queryWithAssistant: false,
  },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn().mockReturnValue({ links: [], isLoading: false }),
  get config() {
    return mockConfig;
  },
}));

const useAssistantMock = jest.mocked(useAssistant);

const mockDataSourceInstance: DataSourceInstanceSettings = {
  uid: 'test-uid',
  name: 'Test Datasource',
  type: 'loki',
} as DataSourceInstanceSettings;

const mockQuery: DataQuery = {
  refId: 'A',
};

const mockQueries: DataQuery[] = [mockQuery];

const defaultProps = {
  query: mockQuery,
  queries: mockQueries,
  dataSourceInstance: mockDataSourceInstance,
  app: CoreApp.Explore,
  datasource: null,
};

describe('QueryActionAssistantButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: feature toggle enabled, assistant available
    mockConfig.featureToggles.queryWithAssistant = true;
    useAssistantMock.mockReturnValue({
      isAvailable: true,
      openAssistant: jest.fn(),
    } as unknown as AssistantHook);
  });

  it('should render nothing when feature toggle is disabled', () => {
    mockConfig.featureToggles.queryWithAssistant = false;
    useAssistantMock.mockReturnValue({
      isAvailable: true,
      openAssistant: jest.fn(),
    } as unknown as AssistantHook);

    const { container } = render(<QueryActionAssistantButton {...defaultProps} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when app is not Explore, Dashboard, or PanelEditor', () => {
    const { container } = render(<QueryActionAssistantButton {...defaultProps} app={CoreApp.Unknown} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when Assistant is not available', () => {
    mockConfig.featureToggles.queryWithAssistant = true;
    useAssistantMock.mockReturnValue({
      isAvailable: false,
      openAssistant: undefined,
    } as unknown as AssistantHook);

    const { container } = render(<QueryActionAssistantButton {...defaultProps} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when openAssistant is not provided', () => {
    mockConfig.featureToggles.queryWithAssistant = true;
    useAssistantMock.mockReturnValue({
      isAvailable: true,
      openAssistant: undefined,
    } as unknown as AssistantHook);

    const { container } = render(<QueryActionAssistantButton {...defaultProps} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render button when feature toggle is enabled and assistant is available', () => {
    mockConfig.featureToggles.queryWithAssistant = true;
    const mockOpenAssistant = jest.fn();
    useAssistantMock.mockReturnValue({
      isAvailable: true,
      openAssistant: mockOpenAssistant,
    } as unknown as AssistantHook);

    render(<QueryActionAssistantButton {...defaultProps} />);

    const button = screen.getByRole('button', { name: /query with assistant/i });
    expect(button).toBeInTheDocument();
  });
});
