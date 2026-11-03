import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { TextMode } from 'app/plugins/panel/text/panelcfg.gen';
import { FORMAT_TOOLBAR_TEST_ID } from 'app/plugins/panel/text/v2/editor/TextNGFormatToolbar';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { TextNGSidebarEditor } from './TextNGSidebarEditor';

// The real CodeMirrorEditor loads a heavy bundle; a textarea is enough to drive the editor's onChange.
jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  createVariableCompletionSource: () => () => null,
  CodeMirrorEditor: ({
    value,
    onChange,
    'aria-label': ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    'aria-label'?: string;
  }) => <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />,
}));

const text = getPanelPlugin({ id: 'text' });
setPluginImportUtils({ importPanelPlugin: async () => text, getPanelPluginFromCache: () => text });

let deactivate: () => void;
afterEach(() => deactivate?.());

function setup() {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'text',
    options: { mode: TextMode.Markdown, content: 'Hello' },
  });
  const dashboard = new DashboardScene({
    isEditing: true,
    body: new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [new AutoGridItem({ body: panel })] }) }),
  });
  deactivate = activateFullSceneTree(dashboard);
  render(
    <>
      <TextNGSidebarEditor panel={panel} />
      <button>Outside</button>
    </>
  );

  return { panel, sidebar: dashboard.state.sidebar, user: userEvent.setup() };
}

describe('TextNGSidebarEditor', () => {
  it('shows the mode picker and the mode-specific format toolbar, without the view toggle', async () => {
    setup();

    expect(await screen.findByRole('textbox', { name: 'Text content' })).toHaveValue('Hello');
    expect(screen.getByRole('button', { name: 'Text mode: Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bullet list' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Preview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Write' })).not.toBeInTheDocument();
  });

  it('puts the mode picker above the format toolbar', async () => {
    setup();
    await screen.findByRole('textbox', { name: 'Text content' });

    const modePicker = screen.getByRole('button', { name: 'Text mode: Markdown' });
    const toolbar = screen.getByTestId(FORMAT_TOOLBAR_TEST_ID);

    expect(modePicker.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toolbar).not.toContainElement(modePicker);
  });

  it('applies typing to the panel right away and records one undoable edit when focus leaves', async () => {
    const { panel, sidebar, user } = setup();
    const editor = await screen.findByRole('textbox', { name: 'Text content' });

    await user.type(editor, ' world');
    await user.click(screen.getByRole('button', { name: 'Outside' }));

    expect(panel.state.options.content).toBe('Hello world');
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.undoStack[0].description).toBe('Text: Content');

    act(() => sidebar.undoAction());
    expect(panel.state.options.content).toBe('Hello');
  });

  it('records a mode change as its own undoable edit', async () => {
    const { panel, sidebar, user } = setup();
    await screen.findByRole('textbox', { name: 'Text content' });

    await user.click(screen.getByRole('button', { name: 'Text mode: Markdown' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'HTML' }));

    expect(panel.state.options.mode).toBe(TextMode.HTML);
    expect(sidebar.state.undoStack.map((action) => action.description)).toEqual(['Text: Mode']);
    expect(screen.queryByRole('button', { name: 'Bullet list' })).not.toBeInTheDocument();

    act(() => sidebar.undoAction());
    expect(panel.state.options.mode).toBe(TextMode.Markdown);
  });
});
