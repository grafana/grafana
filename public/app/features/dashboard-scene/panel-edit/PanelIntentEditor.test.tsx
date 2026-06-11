import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAssistant } from '@grafana/assistant';
import { VizPanel } from '@grafana/scenes';
import { type Panel } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';
import { PanelIntentChips } from '../scene/PanelIntentChips';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { PanelIntentEditor } from './PanelIntentEditor';

type PanelIntent = NonNullable<Panel['intent']>;

jest.mock('../edit-pane/shared', () => ({
  dashboardEditActions: {
    // Execute perform immediately so tests don't need to wait on the undo stack.
    edit: ({ perform }: { perform: () => void }) => perform(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  // The editor subscribes to PanelIntentFillEvent on mount; give it an event
  // bus stub that returns an unsubscribable.
  getAppEvents: () => ({
    subscribe: () => ({ unsubscribe: jest.fn() }),
    publish: jest.fn(),
  }),
}));

function buildPanel(initial?: { intent?: PanelIntent }) {
  const titleItems = initial?.intent ? [new PanelIntentChips({ intent: initial.intent })] : [];
  const vizPanel = new VizPanel({
    key: 'panel-1',
    title: 'Test panel',
    pluginId: 'timeseries',
    titleItems,
  });
  // Mount the panel under a real DashboardScene so the editor's
  // getDashboardSceneFor / dashboardEditActions calls have a scene to walk.
  const scene = new DashboardScene({
    uid: 'dash-1',
    title: 'Test dashboard',
    meta: {},
    body: DefaultGridLayoutManager.fromVizPanels([vizPanel]),
  });
  scene.activate();
  return { vizPanel, scene };
}

function intentOf(vizPanel: VizPanel): PanelIntent | undefined {
  const titleItems = vizPanel.state.titleItems;
  if (!Array.isArray(titleItems)) {
    return undefined;
  }
  const chips = titleItems.find((item): item is PanelIntentChips => item instanceof PanelIntentChips);
  return chips?.state.intent;
}

describe('PanelIntentEditor', () => {
  beforeEach(() => {
    (useAssistant as jest.Mock).mockReturnValue({
      isAvailable: false,
      openAssistant: undefined,
    });
  });

  it('renders empty fields when the panel has no intent', () => {
    const { vizPanel } = buildPanel();
    render(<PanelIntentEditor panel={vizPanel} />);

    // Grafana's <Field> nests the description inside the <label>, so
    // getByLabelText's exact match fails on multi-line labels. Use
    // placeholder/role queries for stable matching across labels with
    // and without descriptions. Owner is no longer a panel field — it
    // lives on the dashboard-level intent (DashboardIntentSummaryBar).
    expect(screen.getByPlaceholderText('p99 < 250ms')).toHaveValue('');
    expect(screen.getByPlaceholderText('p99 > 500ms for 5m')).toHaveValue('');
  });

  it('does not render an owner field (owner is dashboard-level)', () => {
    const { vizPanel } = buildPanel();
    render(<PanelIntentEditor panel={vizPanel} />);

    expect(screen.queryByPlaceholderText('@team-handle')).not.toBeInTheDocument();
  });

  it('renders the body unconditionally — the tab is the container', () => {
    const { vizPanel } = buildPanel();
    render(<PanelIntentEditor panel={vizPanel} />);

    // No collapse: the body is visible as soon as the tab is mounted,
    // regardless of whether the panel has existing intent.
    expect(screen.getByPlaceholderText('p99 < 250ms')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Panel context/i })).not.toBeInTheDocument();
  });

  it('prefills inputs from existing intent', () => {
    const { vizPanel } = buildPanel({
      intent: {
        purpose: 'Track checkout p99.',
        expectedBehavior: { normalRange: 'p99 < 250ms', alertThreshold: 'p99 > 500ms' },
      },
    });
    render(<PanelIntentEditor panel={vizPanel} />);

    expect(screen.getByDisplayValue('Track checkout p99.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('p99 < 250ms')).toBeInTheDocument();
    expect(screen.getByDisplayValue('p99 > 500ms')).toBeInTheDocument();
  });

  it('writes a field back into the panel intent on edit, creating the chip if missing', async () => {
    const { vizPanel } = buildPanel();
    expect(intentOf(vizPanel)).toBeUndefined();

    render(<PanelIntentEditor panel={vizPanel} />);
    await userEvent.type(screen.getByPlaceholderText('p99 < 250ms'), '10');

    expect(intentOf(vizPanel)?.expectedBehavior?.normalRange).toBe('10');
  });

  it('adds and removes failure modes round-trip', async () => {
    const { vizPanel } = buildPanel({ intent: { purpose: 'seed' } });
    render(<PanelIntentEditor panel={vizPanel} />);

    await userEvent.click(screen.getByRole('button', { name: /Add failure mode/i }));
    // After adding, there should be a tag input with placeholder 'db-slow'.
    const tagInput = screen.getByPlaceholderText('db-slow');
    await userEvent.type(tagInput, 'db-slow');

    expect(intentOf(vizPanel)?.failureModes).toEqual([{ tag: 'db-slow' }]);

    await userEvent.click(screen.getByRole('button', { name: /Remove failure mode/i }));
    // Removing the only failure mode should drop the array entirely so the
    // saved JSON doesn't carry an empty `failureModes: []`.
    expect(intentOf(vizPanel)?.failureModes).toBeUndefined();
  });

  it('does not render the "Write" button when the assistant is unavailable', () => {
    const { vizPanel } = buildPanel();
    render(<PanelIntentEditor panel={vizPanel} />);
    expect(screen.queryByRole('button', { name: /^Write$|^Suggest$/i })).not.toBeInTheDocument();
  });

  it('renders "Write" when the assistant is available and triggers openAssistant on click', async () => {
    const openAssistant = jest.fn();
    (useAssistant as jest.Mock).mockReturnValue({
      isAvailable: true,
      openAssistant,
    });

    const { vizPanel } = buildPanel();
    render(<PanelIntentEditor panel={vizPanel} />);

    const button = screen.getByRole('button', { name: /^Write$/i });
    await userEvent.click(button);

    expect(openAssistant).toHaveBeenCalledTimes(1);
    const call = openAssistant.mock.calls[0][0];
    expect(call.mode).toBe('assistant');
    expect(call.autoSend).toBe(true);
    // Routing intent: the prompt must name the tool so the agent reliably
    // picks up the suggest path even without grounding being enabled.
    expect(call.prompt).toMatch(/suggest_dashboard_intent/);
  });

  it('renders "Suggest" when there is existing intent', () => {
    (useAssistant as jest.Mock).mockReturnValue({
      isAvailable: true,
      openAssistant: jest.fn(),
    });

    const { vizPanel } = buildPanel({ intent: { purpose: 'Existing' } });
    render(<PanelIntentEditor panel={vizPanel} />);

    expect(screen.getByRole('button', { name: /^Suggest$/i })).toBeInTheDocument();
  });

  describe('per-field Suggest buttons (E.3)', () => {
    it('does not render per-field suggest buttons when the assistant is unavailable', () => {
      const { vizPanel } = buildPanel();
      render(<PanelIntentEditor panel={vizPanel} />);
      expect(screen.queryByLabelText(/Suggest a purpose statement with AI/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Suggest expected behavior with AI/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Suggest failure modes with AI/i)).not.toBeInTheDocument();
    });

    it('renders per-field suggest buttons when the assistant is available', () => {
      (useAssistant as jest.Mock).mockReturnValue({
        isAvailable: true,
        openAssistant: jest.fn(),
      });
      const { vizPanel } = buildPanel();
      render(<PanelIntentEditor panel={vizPanel} />);
      expect(screen.getByLabelText(/Suggest a purpose statement with AI/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Suggest expected behavior with AI/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Suggest failure modes with AI/i)).toBeInTheDocument();
    });

    it('clicking a per-field suggest button opens the assistant with the correct focus', async () => {
      const openAssistant = jest.fn();
      (useAssistant as jest.Mock).mockReturnValue({ isAvailable: true, openAssistant });

      const { vizPanel } = buildPanel();
      render(<PanelIntentEditor panel={vizPanel} />);

      await userEvent.click(screen.getByLabelText(/Suggest a purpose statement with AI/i));

      expect(openAssistant).toHaveBeenCalledTimes(1);
      const call = openAssistant.mock.calls[0][0];
      expect(call.mode).toBe('assistant');
      expect(call.autoSend).toBe(true);
      expect(call.prompt).toMatch(/suggest_dashboard_intent/);
      expect(call.prompt).toMatch(/focus="purpose"/);
    });
  });
});
