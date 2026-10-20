import { cloneSectionDataLayerSet } from '../utils/clone';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { setAnnotationLayerEnabled } from './annotationLayerEnabled';
import { RowItem } from './layout-rows/RowItem';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';

function annotationLayer(enabled = true) {
  return new DashboardAnnotationsDataLayer({
    name: 'deploys',
    isEnabled: enabled,
    query: { name: 'deploys', enable: enabled, iconColor: 'red' },
  });
}

function repeatedRow() {
  const sourceLayer = annotationLayer(true);
  const row = new RowItem({
    key: 'row-1',
    title: 'Servers',
    $data: new DashboardDataLayerSet({ annotationLayers: [sourceLayer] }),
  });
  const clonedData = cloneSectionDataLayerSet(row.state.$data);
  const cloneRow = row.clone({
    key: 'row-1-clone-1',
    repeatSourceKey: row.state.key,
    repeatByVariable: undefined,
    repeatedRows: undefined,
    $data: clonedData,
  });
  row.setState({ repeatedRows: [cloneRow] });

  return { row, sourceLayer, cloneLayer: layersOf(cloneRow)[0] };
}

function layersOf(section: RowItem | TabItem) {
  const set = section.state.$data;
  if (!(set instanceof DashboardDataLayerSet)) {
    throw new Error('Section has no DashboardDataLayerSet');
  }
  return set.state.annotationLayers.filter((layer) => layer instanceof DashboardAnnotationsDataLayer);
}

describe('setAnnotationLayerEnabled', () => {
  it('updates the repeat source and the clone when the toggle starts on a clone', () => {
    const { sourceLayer, cloneLayer } = repeatedRow();

    setAnnotationLayerEnabled(cloneLayer, false);

    expect(sourceLayer.state.isEnabled).toBe(false);
    expect(sourceLayer.state.query.enable).toBe(false);
    expect(cloneLayer.state.isEnabled).toBe(false);
    expect(cloneLayer.state.query.enable).toBe(false);
  });

  it('updates every row clone when the toggle starts on the source', () => {
    const { sourceLayer, cloneLayer } = repeatedRow();

    setAnnotationLayerEnabled(sourceLayer, false);

    expect(sourceLayer.state.isEnabled).toBe(false);
    expect(cloneLayer.state.isEnabled).toBe(false);
  });

  it('updates tab clones nested inside a repeated row', () => {
    const sourceLayer = annotationLayer(true);
    const tab = new TabItem({
      key: 'tab-1',
      title: 'Tab',
      $data: new DashboardDataLayerSet({ annotationLayers: [sourceLayer] }),
    });
    const row = new RowItem({
      key: 'row-1',
      title: 'Row',
      layout: new TabsLayoutManager({ tabs: [tab] }),
    });
    const clonedData = cloneSectionDataLayerSet(tab.state.$data);
    const cloneTab = tab.clone({
      key: 'tab-1-clone-1',
      repeatSourceKey: undefined,
      $data: clonedData,
    });
    const cloneRow = row.clone({
      key: 'row-1-clone-1',
      repeatSourceKey: row.state.key,
      repeatedRows: undefined,
      layout: new TabsLayoutManager({ tabs: [cloneTab] }),
    });
    row.setState({ repeatedRows: [cloneRow] });

    const cloneLayer = layersOf(cloneTab)[0];
    setAnnotationLayerEnabled(sourceLayer, false);

    expect(sourceLayer.state.isEnabled).toBe(false);
    expect(cloneLayer.state.isEnabled).toBe(false);
    expect(cloneLayer.state.query.enable).toBe(false);
  });
});
