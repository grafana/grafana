import { act, fireEvent, screen, within } from '@testing-library/react';
import { type ReactNode } from 'react';
import { render } from 'test/test-utils';

import { type ChatContextItem } from '@grafana/assistant';
import { reportInteraction } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { isFloatingExtensionSidebarHeld } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { contextSrv } from 'app/core/services/context_srv';
import { type TemplateSelection } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';

import { AssistantDashboardEmpty } from './AssistantDashboardEmpty';
import { openTemplateInAssistant, startPlanningInAssistant } from './handoff';

jest.mock('./handoff', () => ({
  startPlanningInAssistant: jest.fn(),
  openTemplateInAssistant: jest.fn(),
}));

const mockCheckLimits = jest.fn();
jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  checkLimits: () => mockCheckLimits(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('./datasources', () => ({
  getPromptDatasources: () => [{ uid: 'prom-default', type: 'prometheus', name: 'Prometheus' }],
}));

let latestOnSubmit: ((prompt: string, contextItems: ChatContextItem[]) => void | Promise<void>) | undefined;
interface LandingPromptProps {
  onSubmit: (prompt: string, contextItems: ChatContextItem[]) => void | Promise<void>;
  placeholder?: string;
  hostContextItems?: ChatContextItem[];
  onHostContextItemRemove?: (id: string) => void;
  renderHostActions?: () => ReactNode;
}
let latestPromptProps: LandingPromptProps | undefined;

jest.mock('./DashboardLandingPrompt', () => ({
  PROMPT_HEIGHT: 91,
  DashboardLandingPrompt: (props: LandingPromptProps) => {
    latestOnSubmit = props.onSubmit;
    latestPromptProps = props;
    return (
      <div data-testid="dashboard-landing-prompt">
        <div role="textbox" />
        {props.renderHostActions?.()}
      </div>
    );
  },
}));

interface LandingTemplatesProps {
  isOpen: boolean;
  onSelectTemplate: (selection: TemplateSelection) => void;
  selectedTemplateId?: string;
  onTemplatesCount?: (counts: { custom?: number; grafana?: number }) => void;
  className?: string;
}
let latestTemplatesProps: LandingTemplatesProps | undefined;

jest.mock('./LandingTemplates', () => ({
  LandingTemplates: (props: LandingTemplatesProps) => {
    latestTemplatesProps = props;
    return <div data-testid="landing-templates" className={props.className} hidden={!props.isOpen} />;
  },
  LandingTemplatesToggle: ({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => (
    <button type="button" aria-expanded={isOpen} onClick={onToggle}>
      Start from a template
    </button>
  ),
}));

const mockAvailability = {
  testDataSource: undefined,
  showGrafanaTemplates: false,
  showCustomTemplates: false,
  isAvailable: false,
};
jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/hooks/useTemplateDashboardsAvailability', () => ({
  useTemplateDashboardsAvailability: () => mockAvailability,
}));

const mockStartPlanning = jest.mocked(startPlanningInAssistant);
const mockOpenTemplate = jest.mocked(openTemplateInAssistant);

function renderEmpty() {
  const dashboard = new DashboardScene({
    isEditing: true,
    body: AutoGridLayoutManager.createEmpty(),
  });
  const addNewPanel = jest.spyOn(dashboard.state.sidebar, 'addNewPanel').mockImplementation(() => {});
  const { rerender, unmount, user } = render(<AssistantDashboardEmpty dashboard={dashboard} />);
  return { dashboard, addNewPanel, rerender, unmount, user };
}

describe('AssistantDashboardEmpty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestOnSubmit = undefined;
    contextSrv.isSignedIn = true;
    mockCheckLimits.mockResolvedValue({ count: 0, limit: 0, month: '2026-11', isLimitReached: false });
    latestPromptProps = undefined;
    latestTemplatesProps = undefined;
    Object.assign(mockAvailability, {
      showGrafanaTemplates: false,
      showCustomTemplates: false,
      isAvailable: false,
    });
    setTestFlags({ dashboardNewLayouts: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setTestFlags({});
  });

  it('adds a panel through the sidebar instead of opening the panel editor', () => {
    const { addNewPanel } = renderEmpty();

    fireEvent.click(screen.getByRole('button', { name: 'Add visualization' }));

    expect(addNewPanel).toHaveBeenCalledTimes(1);
  });

  it('derives planning summaries from context data and forwards the original selection', async () => {
    renderEmpty();
    const contextItems: ChatContextItem[] = [
      {
        node: {
          id: 'datasources/prom-1',
          name: 'Datasource label',
          navigable: false,
          data: {
            type: 'datasource',
            datasourceUid: 'prom-1',
            datasourceName: 'Prometheus',
            datasourceType: 'prometheus',
          },
        },
        occurrences: ['mention-1'],
      },
      {
        node: {
          id: 'dashboards/dash-1',
          name: 'Dashboard label',
          navigable: false,
          data: { type: 'dashboard', dashboardUid: 'dash-1', dashboardTitle: 'Checkout', folderUid: 'folder-2' },
        },
        occurrences: [],
      },
    ];

    await act(() => latestOnSubmit?.('monitor checkout', contextItems));

    expect(mockStartPlanning).toHaveBeenCalledWith({
      request: 'monitor checkout',
      displayPrompt: 'monitor checkout',
      datasources: [{ uid: 'prom-1', type: 'prometheus', name: 'Prometheus' }],
      context: contextItems,
      dashboards: [{ uid: 'dash-1', title: 'Checkout' }],
    });
    expect(mockStartPlanning.mock.calls[0][0].context).toBe(contextItems);
  });

  it('holds the floating Assistant hidden while its own prompt stands in, until the prompt is submitted', async () => {
    renderEmpty();
    expect(isFloatingExtensionSidebarHeld()).toBe(true);

    await act(() => latestOnSubmit?.('monitor checkout', []));

    expect(isFloatingExtensionSidebarHeld()).toBe(false);
  });

  it('does not hold the floating Assistant on a dashboard the Assistant already drives', () => {
    const dashboard = new DashboardScene({ isEditing: true, body: AutoGridLayoutManager.createEmpty() });
    jest.spyOn(dashboard, 'getEditSessionSource').mockReturnValue('assistant');
    render(<AssistantDashboardEmpty dashboard={dashboard} />);

    expect(isFloatingExtensionSidebarHeld()).toBe(false);
  });

  it('falls back to every datasource when the user picked none', async () => {
    renderEmpty();

    await act(() => latestOnSubmit?.('monitor checkout', []));

    expect(mockStartPlanning).toHaveBeenCalledWith(
      expect.objectContaining({
        datasources: [{ uid: 'prom-default', type: 'prometheus', name: 'Prometheus' }],
        context: [],
        dashboards: [],
      })
    );
  });

  describe('templates under the prompt', () => {
    const red: TemplateSelection = {
      id: 'grafana:1',
      kind: 'template_dashboard',
      url: '/dashboard/template?gnetId=1',
      contextItem: {
        node: { id: 'template-red', name: 'Dashboard Template: RED metrics', navigable: false },
        occurrences: [],
      },
    };
    const use: TemplateSelection = {
      id: 'grafana:2',
      kind: 'template_dashboard',
      url: '/dashboard/template?gnetId=2',
      contextItem: {
        node: { id: 'template-use', name: 'Dashboard Template: USE method', navigable: false },
        occurrences: [],
      },
    };

    const OPEN_KEY = 'grafana.dashboard.landing.templatesOpen';
    const HAS_CUSTOM_KEY = 'grafana.dashboard.landing.hasCustomTemplates';
    const reportCounts = (counts: { custom?: number; grafana?: number }) =>
      act(() => latestTemplatesProps?.onTemplatesCount?.(counts));
    const queryToggle = () => screen.queryByRole('button', { name: 'Start from a template' });

    beforeEach(() => {
      Object.assign(mockAvailability, { showGrafanaTemplates: true, showCustomTemplates: true, isAvailable: true });
      window.localStorage.removeItem(OPEN_KEY);
      window.localStorage.removeItem(HAS_CUSTOM_KEY);
    });

    const toggle = () => screen.getByRole('button', { name: 'Start from a template' });
    const panel = () => screen.getByTestId('landing-templates');

    it('shows the page and the toggle at once, with the panel closed on a first visit', () => {
      renderEmpty();

      expect(screen.getByRole('heading')).toBeVisible();
      expect(within(screen.getByTestId('dashboard-landing-prompt')).getByRole('button')).toBe(toggle());
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expect(panel()).not.toBeVisible();
    });

    it('opens the panel at once on a visit after one that found custom templates, and keeps it open', () => {
      window.localStorage.setItem(HAS_CUSTOM_KEY, 'true');
      renderEmpty();
      expect(panel()).toBeVisible();

      reportCounts({ custom: 0, grafana: 2 });

      expect(panel()).toBeVisible();
      expect(window.localStorage.getItem(HAS_CUSTOM_KEY)).toBe('false');
    });

    it('keeps the panel closed when this visit finds custom templates, and opens it on the next', () => {
      const first = renderEmpty();
      reportCounts({ custom: 2, grafana: 3 });
      expect(panel()).not.toBeVisible();
      first.unmount();

      renderEmpty();

      expect(panel()).toBeVisible();
    });

    it('drops the toggle when the lists have no templates', () => {
      renderEmpty();
      reportCounts({ custom: 0, grafana: 2 });
      expect(toggle()).toBeInTheDocument();

      reportCounts({ custom: 0, grafana: 0 });

      expect(queryToggle()).not.toBeInTheDocument();
      expect(panel()).not.toBeVisible();
    });

    it('keeps an open panel, which then says there are none, when the lists have no templates', () => {
      window.localStorage.setItem(OPEN_KEY, 'true');
      renderEmpty();

      reportCounts({ custom: 0, grafana: 0 });

      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(panel()).toBeVisible();
    });

    it('keeps the toggle a person used to close a panel with no templates', async () => {
      window.localStorage.setItem(OPEN_KEY, 'true');
      const { user } = renderEmpty();
      reportCounts({ custom: 0, grafana: 0 });

      await user.click(toggle());

      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    });

    it("keeps what the last visit found when this visit's custom list does not report", () => {
      window.localStorage.setItem(HAS_CUSTOM_KEY, 'true');
      renderEmpty();

      reportCounts({ grafana: 2 });

      expect(window.localStorage.getItem(HAS_CUSTOM_KEY)).toBe('true');
    });

    it('forgets the custom templates of the last visit when the account no longer offers them', () => {
      window.localStorage.setItem(HAS_CUSTOM_KEY, 'true');
      mockAvailability.showCustomTemplates = false;

      renderEmpty();

      expect(window.localStorage.getItem(HAS_CUSTOM_KEY)).toBe('false');
    });

    it('does not list templates when none are available, and shows the page at once', () => {
      Object.assign(mockAvailability, { showGrafanaTemplates: false, isAvailable: false });
      renderEmpty();

      expect(screen.getByRole('heading')).toBeVisible();
      expect(screen.queryByTestId('landing-templates')).not.toBeInTheDocument();
      expect(queryToggle()).not.toBeInTheDocument();
    });

    it("opens and closes the templates from a toggle next to the prompt's + button", async () => {
      const { user } = renderEmpty();

      await user.click(toggle());
      expect(latestTemplatesProps?.isOpen).toBe(true);
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');

      await user.click(toggle());
      expect(latestTemplatesProps?.isOpen).toBe(false);
    });

    it('keeps the templates as the person last left them on the next visit, over what the lists found', async () => {
      const first = renderEmpty();
      await first.user.click(toggle());
      first.unmount();

      const second = renderEmpty();
      expect(panel()).toBeVisible();
      await second.user.click(toggle());
      second.unmount();

      window.localStorage.setItem(HAS_CUSTOM_KEY, 'true');
      renderEmpty();
      expect(panel()).not.toBeVisible();
    });

    it('attaches the picked template to the prompt and swaps it on the next pick', () => {
      renderEmpty();
      expect(latestPromptProps?.hostContextItems).toEqual([]);

      act(() => latestTemplatesProps?.onSelectTemplate(red));
      expect(latestPromptProps?.hostContextItems).toEqual([red.contextItem]);
      expect(latestPromptProps?.placeholder).toBe('Add changes, or send as is');
      expect(latestTemplatesProps?.selectedTemplateId).toBe('grafana:1');

      act(() => latestTemplatesProps?.onSelectTemplate(use));
      expect(latestPromptProps?.hostContextItems).toEqual([use.contextItem]);

      act(() => latestTemplatesProps?.onSelectTemplate(use));
      expect(latestPromptProps?.hostContextItems).toEqual([]);
      expect(latestPromptProps?.placeholder).toBeUndefined();
    });

    it('clears the pick when the person removes its pill in the prompt', () => {
      renderEmpty();
      act(() => latestTemplatesProps?.onSelectTemplate(red));

      act(() => latestPromptProps?.onHostContextItemRemove?.('template-red'));

      expect(latestTemplatesProps?.selectedTemplateId).toBeUndefined();
      expect(latestPromptProps?.hostContextItems).toEqual([]);
    });

    it('reports the picked template and how many templates were on offer with the prompt', async () => {
      renderEmpty();
      act(() => latestTemplatesProps?.onSelectTemplate(red));
      // Counts that come after the pick still go out with the prompt.
      act(() => latestTemplatesProps?.onTemplatesCount?.({ custom: 3, grafana: 12 }));

      await act(() => latestOnSubmit?.('', [red.contextItem]));

      expect(reportInteraction).toHaveBeenCalledWith('dashboard_prompt_planning_started', {
        source: 'empty_dashboard',
        templateKind: 'template_dashboard',
        customTemplateCount: 3,
        grafanaTemplateCount: 12,
      });
    });

    it('opens the template and has the Assistant adapt it when the prompt is sent empty', async () => {
      renderEmpty();
      act(() => latestTemplatesProps?.onSelectTemplate(red));

      await act(() => latestOnSubmit?.('  ', [red.contextItem]));

      expect(mockOpenTemplate).toHaveBeenCalledWith({
        templateUrl: '/dashboard/template?gnetId=1',
        prompt: 'Adapt this template to my data sources and adjust its queries as needed.',
        context: [red.contextItem],
      });
      expect(mockStartPlanning).not.toHaveBeenCalled();
      expect(screen.queryByTestId('landing-templates')).not.toBeInTheDocument();
    });

    describe('when the Assistant cannot take the prompt', () => {
      async function submitRefused(reason: string) {
        const publish = jest.spyOn(appEvents, 'publish');
        renderEmpty();
        act(() => latestTemplatesProps?.onSelectTemplate(red));

        let refusal: unknown;
        await act(async () => {
          try {
            await latestOnSubmit?.('add a latency panel', [red.contextItem]);
          } catch (error) {
            refusal = error;
          }
        });

        expect(refusal).toEqual(new Error(reason));

        expect(mockStartPlanning).not.toHaveBeenCalled();
        expect(mockOpenTemplate).not.toHaveBeenCalled();
        expect(publish).toHaveBeenCalledWith(expect.objectContaining({ payload: [reason] }));
        // Nothing resets: the picked template and the templates stay, and the rejection keeps the prompt's text.
        expect(latestTemplatesProps?.selectedTemplateId).toBe('grafana:1');
        expect(screen.getByTestId('landing-templates')).toBeInTheDocument();
        expect(isFloatingExtensionSidebarHeld()).toBe(true);
      }

      it('keeps everything as it was when the Assistant cannot be reached', async () => {
        mockCheckLimits.mockRejectedValue(new Error('Failed to check limits'));
        await submitRefused('Could not reach the Assistant. Try sending again.');
      });

      it("keeps everything as it was when this month's prompts are used up", async () => {
        mockCheckLimits.mockResolvedValue({ count: 10, limit: 10, month: '2026-11', isLimitReached: true });
        await submitRefused("You have used all of this month's Assistant prompts.");
      });

      it('asks an anonymous visitor to sign in first', async () => {
        contextSrv.isSignedIn = false;
        await submitRefused('Sign in to use the Assistant.');
        expect(mockCheckLimits).not.toHaveBeenCalled();
      });
    });

    it('still sends the template when the prompt did not hand it back', async () => {
      renderEmpty();
      act(() => latestTemplatesProps?.onSelectTemplate(red));

      await act(() => latestOnSubmit?.('add a latency panel', []));

      expect(mockOpenTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'add a latency panel', context: [red.contextItem] })
      );
    });
  });
});
