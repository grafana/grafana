import { act, render, screen, waitFor } from 'test/test-utils';

import { useSceneObjectState } from '@grafana/scenes';
import { mockComboboxRect } from '@grafana/test-utils';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { ElementEditPane } from '../../sidebar/ElementEditPane';
import { ElementEditPaneRenderer } from '../../sidebar/ElementEditPaneRenderer';
import { type DashboardSidebarLike } from '../../sidebar/types';
import { activateFullSceneTree } from '../../utils/test-utils';

import { annotationEditActions } from './actions';

jest.mock('../../sidebar/ElementEditPaneHeader', () => ({ ElementEditPaneHeader: () => null }));
jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({ queryLibraryEnabled: false }),
}));

function Sidebar({ sidebar }: { sidebar: DashboardSidebarLike }) {
  const { openPane } = useSceneObjectState(sidebar);
  return (
    <>
      <button onClick={() => sidebar.undoAction()}>Undo</button>
      <button onClick={() => sidebar.redoAction()}>Redo</button>
      {openPane instanceof ElementEditPane && <ElementEditPaneRenderer key={openPane.state.key} model={openPane} />}
    </>
  );
}

beforeAll(() => mockComboboxRect());

it('keeps newly added annotation controls editable after undoing a display change', async () => {
  const layer = new DashboardAnnotationsDataLayer({
    name: 'Annotation',
    isHidden: false,
    isEnabled: false,
    query: { name: 'Annotation', enable: false, hide: false, iconColor: 'red' },
  });
  jest.spyOn(layer, 'runLayer').mockImplementation(() => {});
  const dashboard = new DashboardScene({
    isEditing: true,
    $data: new DashboardDataLayerSet({ annotationLayers: [] }),
  });
  const deactivate = activateFullSceneTree(dashboard);
  annotationEditActions.addAnnotation({ source: dashboard.state.$data as DashboardDataLayerSet, addedObject: layer });
  try {
    const { user } = render(<Sidebar sidebar={dashboard.state.sidebar} />);
    await waitFor(() => expect(screen.getByDisplayValue('Annotation')).toHaveFocus());
    const display = await screen.findByDisplayValue('Above dashboard');
    await user.click(display);
    await user.click(await screen.findByRole('option', { name: /Controls menu/ }));
    expect(layer.state.placement).toBe('inControlsMenu');
    expect(display).toHaveValue('Controls menu');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(layer.state.placement).toBeUndefined();
    expect(display).toHaveValue('Above dashboard');

    await user.click(display);
    await user.click(await screen.findByRole('option', { name: /Hidden/ }));
    expect(layer.state.isHidden).toBe(true);
    expect(display).toHaveValue('Hidden');

    const name = screen.getByDisplayValue('Annotation');
    await user.clear(name);
    await user.type(name, 'After undo');
    await user.tab();
    expect(layer.state.name).toBe('After undo');
    expect(name).toHaveValue('After undo');
  } finally {
    act(() => deactivate());
  }
});
