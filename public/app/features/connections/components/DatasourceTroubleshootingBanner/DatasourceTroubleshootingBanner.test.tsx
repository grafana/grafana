import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAssistant } from '@grafana/assistant';
import { useAppPluginInstalled } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { DatasourceTroubleshootingBanner } from './DatasourceTroubleshootingBanner';

jest.mock('@grafana/runtime/internal', () => ({
  UserStorage: jest.fn().mockImplementation(() => ({
    getItem: jest.fn().mockResolvedValue('true'),
    setItem: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useAppPluginInstalled: jest.fn(),
}));

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
  OpenAssistantButton: ({ title, prompt, origin }: Record<string, unknown>) => (
    <button data-testid="fix-with-assistant" data-prompt={String(prompt)} data-origin={String(origin)}>
      {String(title)}
    </button>
  ),
}));

const useAppPluginInstalledMock = jest.mocked(useAppPluginInstalled);
const useAssistantMock = jest.mocked(useAssistant);
const openAssistantMock = jest.fn();

const mockAssistant = (isAvailable: boolean): ReturnType<typeof useAssistant> => ({
  isLoading: false,
  isAvailable,
  openAssistant: isAvailable ? openAssistantMock : undefined,
  closeAssistant: isAvailable ? jest.fn() : undefined,
  toggleAssistant: isAvailable ? jest.fn() : undefined,
});

const bodyText = /Uncover and fix potential issues with your data sources./i;

describe('DatasourceTroubleshootingBanner', () => {
  beforeEach(() => {
    contextSrv.isGrafanaAdmin = true;
    useAppPluginInstalledMock.mockReturnValue({ loading: false, value: true, error: undefined });
    // Assistant unavailable by default; individual tests opt in.
    useAssistantMock.mockReturnValue(mockAssistant(false));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when neither advisor nor assistant is available', async () => {
    contextSrv.isGrafanaAdmin = false;
    useAppPluginInstalledMock.mockReturnValue({ loading: false, value: false, error: undefined });
    render(<DatasourceTroubleshootingBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should not render advisor option when user is not admin', async () => {
    contextSrv.isGrafanaAdmin = false;
    render(<DatasourceTroubleshootingBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should not render advisor option when app is not installed', async () => {
    useAppPluginInstalledMock.mockReturnValue({ loading: false, value: false, error: undefined });
    render(<DatasourceTroubleshootingBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should not render advisor option while useAppPluginInstalled is loading', async () => {
    useAppPluginInstalledMock.mockReturnValue({ loading: true, value: undefined, error: undefined });
    render(<DatasourceTroubleshootingBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should render the advisor link when advisor is available', async () => {
    render(<DatasourceTroubleshootingBanner />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(bodyText)).toBeInTheDocument();
      expect(screen.getByText(/Go to Advisor/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Fix with assistant/i)).not.toBeInTheDocument();
  });

  it('should render the assistant option when the assistant is available even without advisor', async () => {
    contextSrv.isGrafanaAdmin = false;
    useAppPluginInstalledMock.mockReturnValue({ loading: false, value: false, error: undefined });
    useAssistantMock.mockReturnValue(mockAssistant(true));

    render(<DatasourceTroubleshootingBanner />);

    await waitFor(() => {
      expect(screen.getByText(bodyText)).toBeInTheDocument();
      expect(screen.getByText(/Fix with assistant/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Go to Advisor/i)).not.toBeInTheDocument();
  });

  it('should render both options when advisor and assistant are available', async () => {
    useAssistantMock.mockReturnValue(mockAssistant(true));

    render(<DatasourceTroubleshootingBanner />);

    await waitFor(() => {
      expect(screen.getByText(/Fix with assistant/i)).toBeInTheDocument();
      expect(screen.getByText(/Go to Advisor/i)).toBeInTheDocument();
    });
  });

  it('should wire the assistant button with a health-check prompt and origin', async () => {
    useAssistantMock.mockReturnValue(mockAssistant(true));

    render(<DatasourceTroubleshootingBanner />);

    const fixButton = await screen.findByTestId('fix-with-assistant');
    expect(fixButton).toHaveAttribute('data-origin', 'grafana/datasource-list-page/troubleshoot-datasources');
    expect(fixButton).toHaveAttribute(
      'data-prompt',
      'Check the health of my configured data sources and help me fix any issues.'
    );
  });

  it('should dismiss notice when close button is clicked', async () => {
    const { rerender } = render(<DatasourceTroubleshootingBanner />);

    await waitFor(() => {
      expect(screen.getByText(bodyText)).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close alert/i });

    await userEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText(bodyText)).not.toBeInTheDocument();
    });

    // Re-render the component and check that the notice is not rendered
    rerender(<DatasourceTroubleshootingBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
