import { act, fireEvent, render, screen, userEvent } from 'test/test-utils';

import { SceneVariableSet, TestVariable } from '@grafana/scenes';
import { ElementSelectionContext } from '@grafana/ui';

import { cloneSectionDataLayerSet } from '../utils/clone';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DataLayerControlEditWrapper } from './DashboardDataLayerControls';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';
import { WAIT_FOR_MOUSE_REST_DURATION_MS } from './edit-actions-popover/EditActionsPopover';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';

jest.mock('../settings/annotations/AnnotationQueryEditorModal', () => ({
  AnnotationQueryEditorModal: () => null,
}));

function setupRepeatedRow() {
  const sourceLayer = new DashboardAnnotationsDataLayer({
    name: 'deploys',
    isEnabled: true,
    query: { name: 'deploys', enable: true, iconColor: 'red' },
  });
  const sectionVar = new TestVariable({ name: 'sectionVar', value: 'a', text: 'a' });
  const row = new RowItem({
    key: 'row-1',
    title: 'Servers',
    $variables: new SceneVariableSet({ variables: [sectionVar] }),
    $data: new DashboardDataLayerSet({ annotationLayers: [sourceLayer] }),
  });
  const cloneRow = row.clone({
    key: 'row-1-clone-1',
    repeatSourceKey: row.state.key,
    repeatByVariable: undefined,
    repeatedRows: undefined,
    $data: cloneSectionDataLayerSet(row.state.$data),
  });
  row.setState({ repeatedRows: [cloneRow] });

  const cloneSet = cloneRow.state.$data;
  if (!(cloneSet instanceof DashboardDataLayerSet)) {
    throw new Error('Clone row has no annotation set');
  }
  const cloneLayer = cloneSet.state.annotationLayers[0];
  if (!(cloneLayer instanceof DashboardAnnotationsDataLayer)) {
    throw new Error('Clone annotation missing');
  }

  const dashboard = new DashboardScene({
    body: new RowsLayoutManager({ rows: [row] }),
  });

  return { dashboard, sourceLayer, cloneLayer };
}

describe('DataLayerControlEditWrapper repeat edits', () => {
  it('toggles the repeat source when the switch on a clone is clicked', () => {
    const { sourceLayer, cloneLayer } = setupRepeatedRow();

    render(<DataLayerControlEditWrapper layer={cloneLayer} />);

    fireEvent.click(screen.getByRole('switch', { name: 'deploys' }));

    expect(sourceLayer.state.isEnabled).toBe(false);
    expect(sourceLayer.state.query.enable).toBe(false);
    expect(cloneLayer.state.isEnabled).toBe(false);
  });

  it('selects the source annotation before opening the query editor', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { dashboard, sourceLayer, cloneLayer } = setupRepeatedRow();

    render(
      <ElementSelectionContext.Provider
        value={{ enabled: true, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
      >
        <DataLayerControlEditWrapper layer={cloneLayer} />
      </ElementSelectionContext.Provider>
    );

    await user.hover(screen.getByText('deploys'));
    act(() => {
      jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit query' }));
    await act(async () => {});

    expect(dashboard.state.sidebar.getSelectedObject()).toBe(sourceLayer);
    jest.useRealTimers();
  });
});
