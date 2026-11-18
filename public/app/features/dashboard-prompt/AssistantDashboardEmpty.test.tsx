import { act, fireEvent, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type ChatContextItem } from '@grafana/assistant';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { isFloatingExtensionSidebarHeld } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { type TemplateSelection } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';

import { AssistantDashboardEmpty } from './AssistantDashboardEmpty';
import { startPlanningInAssistant } from './handoff';

jest.mock('./handoff', () => ({
  startPlanningInAssistant: jest.fn(),
}));

jest.mock('./datasources', () => ({
  getPromptDatasources: () => [{ uid: 'prom-default', type: 'prometheus', name: 'Prometheus' }],
}));

let latestOnSubmit: ((prompt: string, contextItems: ChatContextItem[]) => void) | undefined;
interface LandingPromptProps {
  onSubmit: (prompt: string, contextItems: ChatContextItem[]) => void;
  placeholder?: string;
  hostContextItems?: ChatContextItem[];
  onHostContextItemRemove?: (id: string) => void;
}
let latestPromptProps: LandingPromptProps | undefined;

jest.mock('./DashboardLandingPrompt', () => ({
  DashboardLandingPrompt: (props: LandingPromptProps) => {
    latestOnSubmit = props.onSubmit;
    latestPromptProps = props;
    return <div data-testid="dashboard-landing-prompt">prompt</div>;
  },
}));

interface LandingTemplatesProps {
  onSelectTemplate: (selection: TemplateSelection) => void;
  selectedTemplateId?: string;
}
let latestTemplatesProps: LandingTemplatesProps | undefined;

jest.mock('./LandingTemplates', () => ({
  LandingTemplates: (props: LandingTemplatesProps) => {
    latestTemplatesProps = props;
    return <div data-testid="landing-templates" />;
  },
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

function renderEmpty() {
  const dashboard = new DashboardScene({
    isEditing: true,
    body: AutoGridLayoutManager.createEmpty(),
  });
  const addNewPanel = jest.spyOn(dashboard.state.sidebar, 'addNewPanel').mockImplementation(() => {});
  render(<AssistantDashboardEmpty dashboard={dashboard} />);
  return { dashboard, addNewPanel };
}

describe('AssistantDashboardEmpty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestOnSubmit = undefined;
    latestPromptProps = undefined;
    latestTemplatesProps = undefined;
    Object.assign(mockAvailability, { showGrafanaTemplates: false, isAvailable: false });
    setTestFlags({ dashboardNewLayouts: true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('adds a panel through the sidebar instead of opening the panel editor', () => {
    const { addNewPanel } = renderEmpty();

    fireEvent.click(screen.getByRole('button', { name: 'Add visualization' }));

    expect(addNewPanel).toHaveBeenCalledTimes(1);
  });

  it('derives planning summaries from context data and forwards the original selection', () => {
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

    act(() => {
      latestOnSubmit?.('monitor checkout', contextItems);
    });

    expect(mockStartPlanning).toHaveBeenCalledWith({
      request: 'monitor checkout',
      displayPrompt: 'monitor checkout',
      datasources: [{ uid: 'prom-1', type: 'prometheus', name: 'Prometheus' }],
      context: contextItems,
      dashboards: [{ uid: 'dash-1', title: 'Checkout' }],
    });
    expect(mockStartPlanning.mock.calls[0][0].context).toBe(contextItems);
  });

  it('holds the floating Assistant hidden while its own prompt stands in, until the prompt is submitted', () => {
    renderEmpty();
    expect(isFloatingExtensionSidebarHeld()).toBe(true);

    act(() => {
      latestOnSubmit?.('monitor checkout', []);
    });

    expect(isFloatingExtensionSidebarHeld()).toBe(false);
  });

  it('does not hold the floating Assistant on a dashboard the Assistant already drives', () => {
    const dashboard = new DashboardScene({ isEditing: true, body: AutoGridLayoutManager.createEmpty() });
    jest.spyOn(dashboard, 'getEditSessionSource').mockReturnValue('assistant');
    render(<AssistantDashboardEmpty dashboard={dashboard} />);

    expect(isFloatingExtensionSidebarHeld()).toBe(false);
  });

  it('falls back to every datasource when the user picked none', () => {
    renderEmpty();

    act(() => {
      latestOnSubmit?.('monitor checkout', []);
    });

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
      title: 'RED metrics',
      kind: 'template_dashboard',
      contextItem: {
        node: { id: 'template-red', name: 'Dashboard Template: RED metrics', navigable: false },
        occurrences: [],
      },
    };
    const use: TemplateSelection = {
      id: 'grafana:2',
      title: 'USE method',
      kind: 'template_dashboard',
      contextItem: {
        node: { id: 'template-use', name: 'Dashboard Template: USE method', navigable: false },
        occurrences: [],
      },
    };

    beforeEach(() => {
      Object.assign(mockAvailability, { showGrafanaTemplates: true, isAvailable: true });
    });

    it('does not list templates when none are available', () => {
      Object.assign(mockAvailability, { showGrafanaTemplates: false, isAvailable: false });
      renderEmpty();

      expect(screen.queryByTestId('landing-templates')).not.toBeInTheDocument();
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

    it('plans from the template alone when the prompt is sent empty', () => {
      renderEmpty();
      act(() => latestTemplatesProps?.onSelectTemplate(red));

      act(() => latestOnSubmit?.('', [red.contextItem]));

      expect(mockStartPlanning).toHaveBeenCalledWith(
        expect.objectContaining({
          request: 'Create a new dashboard based on this dashboard template.',
          displayPrompt: 'Create a new dashboard based on this dashboard template.',
          context: [red.contextItem],
        })
      );
      expect(screen.queryByTestId('landing-templates')).not.toBeInTheDocument();
    });

    it('still sends the template when the prompt did not hand it back', () => {
      renderEmpty();
      act(() => latestTemplatesProps?.onSelectTemplate(red));

      act(() => latestOnSubmit?.('add a latency panel', []));

      expect(mockStartPlanning).toHaveBeenCalledWith(
        expect.objectContaining({ request: 'add a latency panel', context: [red.contextItem] })
      );
    });
  });
});
