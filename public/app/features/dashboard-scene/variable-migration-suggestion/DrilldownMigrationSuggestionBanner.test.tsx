import { of } from 'rxjs';
import { act, render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../scene/DashboardScene';

import { DrilldownMigrationSuggestionBanner } from './DrilldownMigrationSuggestionBanner';
import { detectDrilldownMigrationCandidates, type MigrationSuggestionCandidate } from './detect';

const mockIsAssistantAvailable = jest.fn();
const mockOpenAssistant = jest.fn();
const mockCreateAssistantContextItem = jest.fn();

jest.mock('@grafana/assistant', () => ({
  isAssistantAvailable: () => mockIsAssistantAvailable(),
  openAssistant: (...args: unknown[]) => mockOpenAssistant(...args),
  createAssistantContextItem: (...args: unknown[]) => mockCreateAssistantContextItem(...args),
}));

const mockGetAssistantChatIdToContinue = jest.fn();

jest.mock('app/core/components/AssistantTooltip/assistantSidebarState', () => ({
  getAssistantChatIdToContinue: () => mockGetAssistantChatIdToContinue(),
}));

jest.mock('./detect', () => ({
  ...jest.requireActual('./detect'),
  detectDrilldownMigrationCandidates: jest.fn(),
}));

const mockDetect = jest.mocked(detectDrilldownMigrationCandidates);

const HIGH_CONFIDENCE_CANDIDATE: MigrationSuggestionCandidate = {
  variableName: 'instance',
  datasourceUid: 'prom-a',
  confidence: 'high',
  usages: [{ kind: 'filter', key: 'instance', operator: '=~' }],
};

const LOW_CONFIDENCE_CANDIDATE: MigrationSuggestionCandidate = {
  variableName: 'job',
  datasourceUid: 'prom-a',
  confidence: 'low',
  usages: [],
};

function buildDashboard(overrides: Partial<{ uid: string; canEdit: boolean; canSave: boolean }> = {}) {
  const { uid = 'dash-1', canEdit = true, canSave = false } = overrides;
  return new DashboardScene({
    title: 'test dashboard',
    uid,
    $timeRange: new SceneTimeRange({}),
    meta: { canEdit, canSave },
  });
}

async function renderBanner(dashboard = buildDashboard()) {
  const result = render(<DrilldownMigrationSuggestionBanner dashboard={dashboard} />);
  await waitFor(() => expect(mockDetect).toHaveBeenCalled());
  return result;
}

function enableOurFlag(enabled = true) {
  return act(async () => {
    setTestFlags({ 'grafana.drilldownMigrationAssistantSuggestion': enabled });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  mockIsAssistantAvailable.mockReturnValue(of(true));
  mockOpenAssistant.mockReset();
  mockCreateAssistantContextItem.mockImplementation((type, params) => ({ node: { type, params } }));
  mockGetAssistantChatIdToContinue.mockReturnValue('chat-1');
  mockDetect.mockResolvedValue([HIGH_CONFIDENCE_CANDIDATE]);
  config.featureToggles.dashboardUnifiedDrilldownControls = true;
});

afterEach(async () => {
  await act(async () => {
    setTestFlags({});
  });
  config.featureToggles = {};
  jest.clearAllMocks();
});

describe('DrilldownMigrationSuggestionBanner', () => {
  it('does not render when the flag is disabled', async () => {
    await enableOurFlag(false);
    await renderBanner();

    expect(screen.queryByText(/may benefit from filters and group by/)).not.toBeInTheDocument();
  });

  it('does not render when dashboardUnifiedDrilldownControls is off', async () => {
    await enableOurFlag(true);
    config.featureToggles.dashboardUnifiedDrilldownControls = false;
    await renderBanner();

    expect(screen.queryByText(/may benefit from filters and group by/)).not.toBeInTheDocument();
  });

  it('does not render when the assistant is not available', async () => {
    await enableOurFlag(true);
    mockIsAssistantAvailable.mockReturnValue(of(false));
    await renderBanner();

    expect(screen.queryByText(/may benefit from filters and group by/)).not.toBeInTheDocument();
  });

  it('does not render when the user cannot edit the dashboard', async () => {
    await enableOurFlag(true);
    await renderBanner(buildDashboard({ canEdit: false, canSave: false }));

    expect(screen.queryByText(/may benefit from filters and group by/)).not.toBeInTheDocument();
  });

  it('does not render when there are no candidates', async () => {
    await enableOurFlag(true);
    mockDetect.mockResolvedValue([]);
    await renderBanner();

    expect(screen.queryByText(/may benefit from filters and group by/)).not.toBeInTheDocument();
  });

  it('renders when every gate passes', async () => {
    await enableOurFlag(true);
    await renderBanner();

    expect(await screen.findByText(/may benefit from filters and group by/)).toBeInTheDocument();
  });

  it('does not render once dismissed for this dashboard, including on a fresh mount', async () => {
    await enableOurFlag(true);
    const dashboard = buildDashboard({ uid: 'dash-dismiss' });
    const { user } = await renderBanner(dashboard);

    await screen.findByText(/may benefit from filters and group by/);
    await user.click(screen.getByRole('button', { name: 'Close alert' }));

    expect(screen.queryByText(/may benefit from filters and group by/)).not.toBeInTheDocument();

    await renderBanner(buildDashboard({ uid: 'dash-dismiss' }));
    expect(screen.queryByText(/may benefit from filters and group by/)).not.toBeInTheDocument();
  });

  it('does not render on any dashboard once dismissed globally', async () => {
    await enableOurFlag(true);
    const { user } = await renderBanner(buildDashboard({ uid: 'dash-a' }));

    await screen.findByText(/may benefit from filters and group by/);
    await user.click(screen.getByRole('button', { name: "Don't suggest this again" }));

    expect(screen.queryByText(/may benefit from filters and group by/)).not.toBeInTheDocument();

    await renderBanner(buildDashboard({ uid: 'dash-b' }));
    expect(screen.queryByText(/may benefit from filters and group by/)).not.toBeInTheDocument();
  });

  it('opens the assistant with the expected prompt/context/mode/autoSend/chatId when the CTA is clicked', async () => {
    await enableOurFlag(true);
    mockDetect.mockResolvedValue([HIGH_CONFIDENCE_CANDIDATE, LOW_CONFIDENCE_CANDIDATE]);
    const dashboard = buildDashboard({ uid: 'dash-cta' });
    const { user } = await renderBanner(dashboard);

    await screen.findByText(/may benefit from filters and group by/);
    await user.click(screen.getByRole('button', { name: 'Ask Assistant to migrate' }));

    expect(mockOpenAssistant).toHaveBeenCalledTimes(1);
    expect(mockOpenAssistant).toHaveBeenCalledWith({
      origin: 'grafana/dashboard-scene/drilldown-migration-suggestion',
      mode: 'assistant',
      prompt: 'look at this dashboard and see if any variables can be migrated to filters and group by and do it',
      autoSend: true,
      appendContext: true,
      chatId: 'chat-1',
      context: [
        {
          node: {
            type: 'structured',
            params: { data: { dashboardUid: 'dash-cta', candidates: [HIGH_CONFIDENCE_CANDIDATE] } },
          },
        },
      ],
    });
  });
});
