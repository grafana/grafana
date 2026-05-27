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

/**
 * The editor is wrapped in a ControlledCollapse that defaults closed
 * for panels with no authored intent (Phase E.1) and open for panels
 * that already have intent. Tests that exercise the body for empty
 * intent must expand the collapse first.
 */
async function expandPanelContext() {
  const header = screen.queryByRole('button', { name: /Panel context/i });
  if (header && header.getAttribute('aria-expanded') === 'false') {
    await userEvent.click(header);
  }
}

describe('PanelIntentEditor', () => {
  beforeEach(() => {
    (useAssistant as jest.Mock).mockReturnValue({
      isAvailable: false,
      openAssistant: undefined,
    });
  });

  it('renders empty fields when the panel has no intent', async () => {
    const { vizPanel } = buildPanel();
    render(<PanelIntentEditor panel={vizPanel} />);
    await expandPanelContext();

    // Grafana's <Field> nests the description inside the <label>, so
    // getByLabelText's exact match fails on multi-line labels. Use
    // placeholder/role queries for stable matching across labels with
    // and without descriptions.
    expect(screen.getByPlaceholderText('@team-handle')).toHaveValue('');
    expect(screen.getByPlaceholderText('p99 < 250ms')).toHaveValue('');
    expect(screen.getByPlaceholderText('p99 > 500ms for 5m')).toHaveValue('');
  });

  it('starts collapsed when the panel has no intent and expands on click', async () => {
    const { vizPanel } = buildPanel();
    render(<PanelIntentEditor panel={vizPanel} />);

    // Default-closed: form body is not in the DOM yet.
    expect(screen.queryByPlaceholderText('@team-handle')).not.toBeInTheDocument();

    const header = screen.getByRole('button', { name: /Panel context/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(header);
    expect(screen.getByPlaceholderText('@team-handle')).toBeInTheDocument();
  });

  it('starts expanded when the panel already has intent so returning authors see their content', () => {
    const { vizPanel } = buildPanel({ intent: { purpose: 'Track checkout p99.' } });
    render(<PanelIntentEditor panel={vizPanel} />);

    // Default-open when intent exists: body is immediately visible.
    expect(screen.getByDisplayValue('Track checkout p99.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Panel context/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('prefills inputs from existing intent', () => {
    const { vizPanel } = buildPanel({
      intent: {
        purpose: 'Track checkout p99.',
        owner: '@checkout-team',
        expectedBehavior: { normalRange: 'p99 < 250ms', alertThreshold: 'p99 > 500ms' },
      },
    });
    render(<PanelIntentEditor panel={vizPanel} />);

    expect(screen.getByDisplayValue('Track checkout p99.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('@checkout-team')).toBeInTheDocument();
    expect(screen.getByDisplayValue('p99 < 250ms')).toBeInTheDocument();
    expect(screen.getByDisplayValue('p99 > 500ms')).toBeInTheDocument();
  });

  it('writes owner back into the panel intent on edit, creating the chip if missing', async () => {
    const { vizPanel } = buildPanel();
    expect(intentOf(vizPanel)).toBeUndefined();

    render(<PanelIntentEditor panel={vizPanel} />);
    await expandPanelContext();
    await userEvent.type(screen.getByPlaceholderText('@team-handle'), 'me');

    expect(intentOf(vizPanel)?.owner).toBe('me');
  });

  it('adds and removes failure modes round-trip', async () => {
    // Seeding purpose opens the collapse automatically (the editor
    // defaults to open when intent already exists), so the body is
    // visible without needing an extra click.
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

  it('does not render the "Draft with AI" button when the assistant is unavailable', async () => {
    const { vizPanel } = buildPanel();
    render(<PanelIntentEditor panel={vizPanel} />);
    // Expand so the absence is meaningful — without expanding, the
    // body (including the button) is collapsed away regardless of
    // assistant availability and the assertion would pass for the
    // wrong reason.
    await expandPanelContext();
    expect(screen.queryByRole('button', { name: /Draft with AI|Refine with AI/i })).not.toBeInTheDocument();
  });

  it('renders "Draft with AI" when the assistant is available and triggers openAssistant on click', async () => {
    const openAssistant = jest.fn();
    (useAssistant as jest.Mock).mockReturnValue({
      isAvailable: true,
      openAssistant,
    });

    const { vizPanel } = buildPanel();
    render(<PanelIntentEditor panel={vizPanel} />);
    await expandPanelContext();

    const button = screen.getByRole('button', { name: /Draft with AI/i });
    await userEvent.click(button);

    expect(openAssistant).toHaveBeenCalledTimes(1);
    const call = openAssistant.mock.calls[0][0];
    expect(call.mode).toBe('assistant');
    expect(call.autoSend).toBe(true);
    // Routing intent: the prompt must name the tool so the agent reliably
    // picks up the suggest path even without grounding being enabled.
    expect(call.prompt).toMatch(/suggest_dashboard_intent/);
  });

  it('renders "Refine with AI" when there is existing intent', () => {
    (useAssistant as jest.Mock).mockReturnValue({
      isAvailable: true,
      openAssistant: jest.fn(),
    });

    const { vizPanel } = buildPanel({ intent: { purpose: 'Existing' } });
    render(<PanelIntentEditor panel={vizPanel} />);

    expect(screen.getByRole('button', { name: /Refine with AI/i })).toBeInTheDocument();
  });
});
