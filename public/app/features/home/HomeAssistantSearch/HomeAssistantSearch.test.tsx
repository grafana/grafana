import { render, screen, waitFor, userEvent } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { HomeAssistantSearch } from './HomeAssistantSearch';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  getBackendSrv: () => ({
    put: jest.fn().mockResolvedValue({}),
  }),
}));

const mockOpenAssistant = jest.fn();

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(() => ({
    isLoading: false,
    isAvailable: true,
    openAssistant: mockOpenAssistant,
    closeAssistant: jest.fn(),
    toggleAssistant: jest.fn(),
  })),
  useTerms: jest.fn(() => ({
    accepted: true,
    termsType: null,
    loading: false,
    error: null,
  })),
  useLimits: jest.fn(() => ({
    count: 0,
    limit: 100,
    month: '2026-05',
    isLimitReached: false,
    loading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const assistantModule = require('@grafana/assistant');

function setAssistantAvailable(available: boolean) {
  assistantModule.useAssistant.mockReturnValue({
    isLoading: false,
    isAvailable: available,
    openAssistant: available ? mockOpenAssistant : undefined,
    closeAssistant: available ? jest.fn() : undefined,
    toggleAssistant: available ? jest.fn() : undefined,
  });
}

function setTerms(overrides: Partial<ReturnType<typeof assistantModule.useTerms>>) {
  assistantModule.useTerms.mockReturnValue({
    accepted: true,
    termsType: null,
    loading: false,
    error: null,
    ...overrides,
  });
}

function setLimits(overrides: Partial<ReturnType<typeof assistantModule.useLimits>>) {
  assistantModule.useLimits.mockReturnValue({
    count: 0,
    limit: 100,
    month: '2026-05',
    isLimitReached: false,
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  });
}

describe('HomeAssistantSearch', () => {
  const originalHasRole = contextSrv.hasRole.bind(contextSrv);
  const originalIsGrafanaAdmin = contextSrv.isGrafanaAdmin;

  beforeEach(() => {
    jest.clearAllMocks();
    setAssistantAvailable(true);
    setTerms({});
    setLimits({});
    // Default to admin
    jest.spyOn(contextSrv, 'hasRole').mockImplementation((role: string) => role === 'Admin');
    contextSrv.isGrafanaAdmin = false;
  });

  afterEach(() => {
    contextSrv.hasRole = originalHasRole;
    contextSrv.isGrafanaAdmin = originalIsGrafanaAdmin;
  });

  it('renders nothing when assistant is not available', () => {
    setAssistantAvailable(false);
    const { container } = render(<HomeAssistantSearch />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders bar and disclaimer when admin needs to auto-accept MSA terms', () => {
    setTerms({ accepted: false, termsType: 'msa' });

    render(<HomeAssistantSearch />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText(/By using Grafana Assistant, you will be enabling this AI Feature/i)).toBeInTheDocument();
  });

  it('renders nothing for non-admin when MSA terms are unaccepted', () => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    contextSrv.isGrafanaAdmin = false;
    setTerms({ accepted: false, termsType: 'msa' });

    const { container } = render(<HomeAssistantSearch />);
    expect(container).toBeEmptyDOMElement();
  });

  it('submits prompt and opens assistant when terms are accepted', async () => {
    render(<HomeAssistantSearch />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'How do I create a dashboard?');
    await userEvent.click(screen.getByRole('button', { name: 'Ask Assistant' }));

    await waitFor(() => {
      expect(mockOpenAssistant).toHaveBeenCalledWith({
        origin: 'grafana/home',
        prompt: 'How do I create a dashboard?',
        autoSend: true,
      });
    });

    expect(reportInteraction).toHaveBeenCalledWith('grafana_home_assistant_submit', {
      promptLength: 'How do I create a dashboard?'.length,
      autoAcceptedTerms: false,
    });
  });

  it('shows disabled bar with Upgrade link when limit is reached and user is admin', () => {
    setLimits({ isLimitReached: true });

    render(<HomeAssistantSearch />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    expect(screen.getByRole('link', { name: /upgrade/i })).toHaveAttribute(
      'href',
      'https://grafana.com/products/cloud/'
    );
  });

  it('shows disabled bar without Upgrade link when limit is reached and user is non-admin', () => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    contextSrv.isGrafanaAdmin = false;
    setLimits({ isLimitReached: true });

    render(<HomeAssistantSearch />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    expect(screen.queryByRole('link', { name: /upgrade/i })).not.toBeInTheDocument();
  });

  it('submits with empty input using animated placeholder as prompt', async () => {
    render(<HomeAssistantSearch />);

    // Don't type anything — the animated placeholder becomes the prompt
    await userEvent.click(screen.getByRole('button', { name: 'Ask Assistant' }));

    await waitFor(() => {
      expect(mockOpenAssistant).toHaveBeenCalledWith(
        expect.objectContaining({ origin: 'grafana/home', autoSend: true })
      );
    });
  });

  it('fires tracking events on submit and upgrade click', async () => {
    setLimits({ isLimitReached: true });

    render(<HomeAssistantSearch />);

    // Upgrade CTA tracking
    const upgradeLink = screen.getByRole('link', { name: /upgrade/i });
    await userEvent.click(upgradeLink);

    expect(reportInteraction).toHaveBeenCalledWith('grafana_home_assistant_upgrade_click', {});
  });
});
