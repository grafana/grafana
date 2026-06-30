import { render, screen } from '@testing-library/react';

import { VizPanel } from '@grafana/scenes';

import { LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { buildPanelEditScene } from '../PanelEditor';

import { PanelEditorRendererNext } from './PanelEditorRendererNext';
import { usePanelEditorShell } from './hooks';

jest.mock('./hooks', () => ({
  usePanelEditorShell: jest.fn(),
}));

jest.mock('./VizAndDataPaneNext', () => ({
  VizAndDataPaneNext: () => <div data-testid="viz-and-data-pane" />,
}));

jest.mock('app/features/library-panels/state/api', () => ({
  ...jest.requireActual('app/features/library-panels/state/api'),
  getConnectedDashboards: jest.fn().mockResolvedValue([]),
}));

// The splitter / options-pane shell is irrelevant to the modals under test, so it is stubbed out.
// The cast mirrors the scene-hook mocking pattern in the sibling VizAndDataPaneNext.test.tsx.
const shell = {
  dashboard: {},
  optionsPane: undefined,
  splitter: {
    containerProps: { className: '' },
    primaryProps: { className: '' },
    secondaryProps: { className: '' },
    splitterProps: { className: '' },
    splitterState: { collapsed: false },
    onToggleCollapse: jest.fn(),
  },
} as unknown as ReturnType<typeof usePanelEditorShell>;

function setupLibraryPanelEditor() {
  const panel = new VizPanel({ key: 'lib-panel-1', pluginId: 'text' });
  panel.setState({
    $behaviors: [
      new LibraryPanelBehavior({
        isLoaded: true,
        uid: 'uid',
        name: 'libraryPanelName',
        _loadedPanel: { uid: 'uid', name: 'libraryPanelName', model: { type: 'text' }, type: 'panel', version: 1 },
      }),
    ],
  });
  new DashboardGridItem({ body: panel });
  return buildPanelEditScene(panel);
}

describe('PanelEditorRendererNext', () => {
  beforeEach(() => {
    jest.mocked(usePanelEditorShell).mockReturnValue(shell);
  });

  it('shows the update modal when the save library panel flow is triggered', async () => {
    const editor = setupLibraryPanelEditor();
    editor.onSaveLibraryPanel();

    render(<PanelEditorRendererNext model={editor} />);

    expect(await screen.findByRole('dialog', { name: 'Save library panel' })).toBeInTheDocument();
  });

  it('shows the unlink modal when the unlink flow is triggered', () => {
    const editor = setupLibraryPanelEditor();
    editor.onUnlinkLibraryPanel();

    render(<PanelEditorRendererNext model={editor} />);

    expect(screen.getByRole('dialog', { name: 'Do you really want to unlink this panel?' })).toBeInTheDocument();
  });
});
