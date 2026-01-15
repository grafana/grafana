import { render, screen } from '@testing-library/react';

import { AssistantHook, useAssistant } from '@grafana/assistant';
import { CoreApp, DataSourceInstanceSettings } from '@grafana/data';
import { evaluateBooleanFlag } from '@grafana/runtime/internal';
import { DataQuery } from '@grafana/schema';

import { QueryActionAssistantButton } from './QueryActionAssistantButton';

// Mock the assistant hook
jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn(),
}));

// Mock evaluateBooleanFlag
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  evaluateBooleanFlag: jest.fn(),
}));


const useAssistantMock = jest.mocked(useAssistant);
const evaluateBooleanFlagMock = jest.mocked(evaluateBooleanFlag);

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
    evaluateBooleanFlagMock.mockReturnValue(true);
    useAssistantMock.mockReturnValue({
      isAvailable: true,
      openAssistant: jest.fn(),
    } as unknown as AssistantHook);
  });

  it('should render nothing when feature toggle is disabled', () => {
    evaluateBooleanFlagMock.mockReturnValue(false);
    useAssistantMock.mockReturnValue({
      isAvailable: true,
      openAssistant: jest.fn(),
    } as unknown as AssistantHook);

    const { container } = render(<QueryActionAssistantButton {...defaultProps} />);

    expect(container.firstChild).toBeNull();
    expect(evaluateBooleanFlagMock).toHaveBeenCalledWith('queryWithAssistant', false);
  });

  it('should render nothing when Assistant is not available', () => {
    evaluateBooleanFlagMock.mockReturnValue(true);
    useAssistantMock.mockReturnValue({
      isAvailable: false,
      openAssistant: undefined,
    } as unknown as AssistantHook);

    const { container } = render(<QueryActionAssistantButton {...defaultProps} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when openAssistant is not provided', () => {
    evaluateBooleanFlagMock.mockReturnValue(true);
    useAssistantMock.mockReturnValue({
      isAvailable: true,
      openAssistant: undefined,
    } as unknown as AssistantHook);

    const { container } = render(<QueryActionAssistantButton {...defaultProps} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render button when feature toggle is enabled and assistant is available', () => {
    evaluateBooleanFlagMock.mockReturnValue(true);
    const mockOpenAssistant = jest.fn();
    useAssistantMock.mockReturnValue({
      isAvailable: true,
      openAssistant: mockOpenAssistant,
    } as unknown as AssistantHook);

    render(<QueryActionAssistantButton {...defaultProps} />);

    const button = screen.getByRole('button', { name: /query with assistant/i });
    expect(button).toBeInTheDocument();
    expect(evaluateBooleanFlagMock).toHaveBeenCalledWith('queryWithAssistant', false);
  });
});
