import userEvent from '@testing-library/user-event';
import { act, render, screen, waitFor } from 'test/test-utils';

import { useSceneObjectState } from '@grafana/scenes';
import { mockComboboxRect } from '@grafana/test-utils';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { ElementEditPane } from '../../sidebar/ElementEditPane';
import { ElementEditPaneRenderer } from '../../sidebar/ElementEditPaneRenderer';
import { type DashboardSidebarLike } from '../../sidebar/types';
import { activateFullSceneTree } from '../../utils/test-utils';

import { AnnotationControlsDisplayPicker } from './AnnotationBasicOptions';
import { annotationEditActions } from './actions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({}),
    getList: jest.fn(),
    getInstanceSettings: jest.fn(),
    reload: jest.fn(),
  })),
}));

jest.mock('../../sidebar/ElementEditPaneHeader', () => ({ ElementEditPaneHeader: () => null }));
jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({ queryLibraryEnabled: false }),
}));

beforeAll(() => {
  mockComboboxRect();
});

function layerOnTab() {
  const layer = new DashboardAnnotationsDataLayer({
    name: 'Deploys',
    isHidden: false,
    query: { name: 'Deploys', enable: true, iconColor: 'red' },
  });
  const data = new DashboardDataLayerSet({ annotationLayers: [layer] });
  new TabItem({ title: 'New tab', $data: data, layout: AutoGridLayoutManager.createEmpty() });
  return layer;
}

function layerOnDashboard() {
  const layer = new DashboardAnnotationsDataLayer({
    name: 'Deploys',
    isHidden: false,
    query: { name: 'Deploys', enable: true, iconColor: 'red' },
  });
  new DashboardScene({ $data: new DashboardDataLayerSet({ annotationLayers: [layer] }) });
  return layer;
}

describe('AnnotationControlsDisplayPicker', () => {
  it('offers the section placement and hidden for a tab annotation', async () => {
    const user = userEvent.setup();
    render(<AnnotationControlsDisplayPicker layer={layerOnTab()} />);

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('Top of tab')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.queryByText('Controls menu')).not.toBeInTheDocument();
  });

  it('keeps controls menu for a dashboard annotation', async () => {
    const user = userEvent.setup();
    render(<AnnotationControlsDisplayPicker layer={layerOnDashboard()} />);

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('Above dashboard')).toBeInTheDocument();
    expect(screen.getByText('Controls menu')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('hides the control when Hidden is selected', async () => {
    const user = userEvent.setup();
    const layer = layerOnTab();
    const spy = jest.spyOn(annotationEditActions, 'changeAnnotationControlsDisplay').mockImplementation(() => {});
    render(<AnnotationControlsDisplayPicker layer={layer} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Hidden'));

    expect(spy).toHaveBeenCalledWith({
      source: layer,
      oldValue: { isHidden: false, placement: undefined },
      newValue: { isHidden: true, placement: undefined },
    });
    spy.mockRestore();
  });
});

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
