import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  type SceneObject,
  SceneObjectBase,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { useStyles2 } from '@grafana/ui';
import {
  TilingLayout,
  type TilingLayoutDocument,
  type TilingLayoutNode,
  type TilingViewInfo,
  createTilingDocument,
  emptyTilingDocument,
  openTilingView,
  sanitizeTilingDocument,
  tilingLayout,
} from '@grafana/ui/unstable';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty/DashboardEmpty';

import { addElement } from '../../actions/element/addElement';
import { removeElement } from '../../actions/element/removeElement';
import { serializeTilingLayout } from '../../serialization/layoutSerializers/TilingLayoutSerializer';
import { dashboardSceneGraph, type PanelIdGenerator } from '../../utils/dashboardSceneGraph';
import { useDashboard } from '../../utils/utils';
import { getVizPanelKeyForPanelId } from '../../utils/utils-panels';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { type LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { TilingLayoutPanelChrome } from './TilingLayoutPanelChrome';

interface TilingLayoutManagerState extends SceneObjectState {
  /** Flat list of all panels. Their placement is described by the document, keyed by VizPanel key. */
  panels: VizPanel[];
  document: TilingLayoutDocument;
}

const VIEW_TYPE_VIZ = 'viz';

/**
 * A top level only layout that renders its panels with the TilingLayout component from @grafana/ui.
 * It is not part of the layoutRegistry as it is not selectable for rows or tabs.
 */
export class TilingLayoutManager extends SceneObjectBase<TilingLayoutManagerState> implements DashboardLayoutManager {
  public static Component = TilingLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;
  public readonly isTilingLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.tiling-layout.name', 'Tiling');
    },
    get description() {
      return t('dashboard.tiling-layout.description', 'Dock, tab, float and resize panels like in an IDE');
    },
    id: 'TilingLayout',
    createFromLayout: TilingLayoutManager.createFromLayout,
    isGridLayout: true,
    icon: 'columns',
  };

  public readonly descriptor = TilingLayoutManager.descriptor;

  public constructor(state: Partial<TilingLayoutManagerState>) {
    super({
      ...state,
      panels: state.panels ?? [],
      document: state.document ?? emptyTilingDocument(),
    });

    this.state.panels.forEach(applyTilingChrome);
  }

  public serialize(isSnapshot?: boolean): DashboardV2Spec['layout'] {
    return serializeTilingLayout(this, isSnapshot);
  }

  public getVizPanels(): VizPanel[] {
    return this.state.panels;
  }

  public getOutlineChildren(): SceneObject[] {
    return this.state.panels;
  }

  public getAllGridTypes(): string[] {
    return [TilingLayoutManager.descriptor.id];
  }

  public onDocumentChange(document: TilingLayoutDocument) {
    this.setState({ document });
  }

  public addPanel(vizPanel: VizPanel) {
    const panelId = dashboardSceneGraph.getNextPanelId(this);
    const key = getVizPanelKeyForPanelId(panelId);

    vizPanel.setState({ key });
    vizPanel.clearParent();
    applyTilingChrome(vizPanel);

    const { panels, document } = this.state;
    const nextDocument = openTilingView(
      document,
      key,
      getViewRecord(vizPanel),
      getPlacementForNewView(document, panels)
    );

    addElement({
      meta: { actionId: 'panel.add', scope: 'tiling' },
      addedObject: vizPanel,
      source: this,
      perform: () => this.setState({ panels: [...panels, vizPanel], document: nextDocument }),
      undo: () => this.setState({ panels, document }),
    });
  }

  public removePanel(panel: VizPanel) {
    const { panels, document } = this.state;
    const key = panel.state.key;

    if (!key || !panels.includes(panel)) {
      return;
    }

    // Views that are unknown to the document are dropped from the tree when sanitizing.
    const { [key]: _removed, ...views } = document.views;
    const nextDocument = sanitizeTilingDocument({ ...document, views });

    removeElement({
      meta: { actionId: 'panel.remove', scope: 'tiling' },
      removedObject: panel,
      source: this,
      perform: () => this.setState({ panels: panels.filter((p) => p !== panel), document: nextDocument }),
      undo: () => this.setState({ panels, document }),
    });
  }

  // panelIdGenerator is a shared counter to ensure unique panel IDs across siblings.
  public duplicate(panelIdGenerator?: PanelIdGenerator): DashboardLayoutManager {
    const { panels, document } = this.state;
    const nextId = panelIdGenerator ?? (panels.length ? dashboardSceneGraph.getPanelIdGenerator(panels[0]) : undefined);

    const keyMap = new Map<string, string>();
    const clonedPanels = panels.map((panel) => {
      const key = nextId ? getVizPanelKeyForPanelId(nextId()) : panel.state.key!;
      keyMap.set(panel.state.key!, key);
      return panel.clone({ key });
    });

    return this.clone({
      key: undefined,
      panels: clonedPanels,
      document: remapViewIds(document, keyMap),
    });
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    return this.clone({});
  }

  public static createEmpty(): TilingLayoutManager {
    return new TilingLayoutManager({});
  }

  public static createFromLayout(layout: DashboardLayoutManager): TilingLayoutManager {
    const panels = layout.getVizPanels().map((panel) => panel.clone());
    return new TilingLayoutManager({ panels, document: createDocumentForPanels(panels) });
  }
}

function TilingLayoutManagerRenderer({ model }: SceneComponentProps<TilingLayoutManager>) {
  const { panels, document } = model.useState();
  const dashboard = useDashboard(model);
  const styles = useStyles2(getStyles);

  const panelsByKey = useMemo(() => new Map(panels.map((panel) => [panel.state.key!, panel])), [panels]);
  const titleVersion = usePanelTitleVersion(panels);

  const renderView = useCallback(
    (view: TilingViewInfo) => {
      const panel = panelsByKey.get(view.id);
      return panel ? (
        <div className={styles.view}>
          <panel.Component model={panel} />
        </div>
      ) : null;
    },
    [panelsByKey, styles.view]
  );

  const getViewTitle = useCallback(
    (id: string, record: TilingLayoutDocument['views'][string]) =>
      panelsByKey.get(id)?.state.title || record.title || id,
    // The title is not part of this component's state, titleVersion makes the layout pick up changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panelsByKey, titleVersion]
  );

  const onBeforeViewClose = useCallback(
    (view: TilingViewInfo) => {
      // Closing a view removes the panel from the dashboard, which updates the document itself.
      const panel = panelsByKey.get(view.id);
      if (panel) {
        model.removePanel(panel);
      }
      return false;
    },
    [model, panelsByKey]
  );

  if (model.parent === dashboard && panels.length === 0) {
    return (
      <DashboardEmpty dashboard={dashboard} canCreate={!!dashboard.state.meta.canEdit} key="dashboard-empty-state" />
    );
  }

  return (
    <div className={styles.container}>
      <TilingLayout
        layout={document}
        onLayoutChange={model.onDocumentChange.bind(model)}
        renderView={renderView}
        getViewTitle={getViewTitle}
        onBeforeViewClose={onBeforeViewClose}
      />
    </div>
  );
}

/** Returns a counter that changes when the title of any of the panels changes. */
function usePanelTitleVersion(panels: VizPanel[]): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const subscriptions = panels.map((panel) =>
      panel.subscribeToState((state, prevState) => {
        if (state.title !== prevState.title) {
          setVersion((v) => v + 1);
        }
      })
    );
    return () => subscriptions.forEach((subscription) => subscription.unsubscribe());
  }, [panels]);

  return version;
}

/** The title and menu of a panel are rendered by the TilingLayout, so the panel must not render its own. */
function applyTilingChrome(panel: VizPanel) {
  if (panel.state.chrome !== TilingLayoutPanelChrome) {
    panel.setState({ chrome: TilingLayoutPanelChrome });
  }
}

function getViewRecord(panel: VizPanel) {
  return { title: panel.state.title, type: VIEW_TYPE_VIZ };
}

/** Lays the panels out in a square-ish grid of rows and columns. */
function createDocumentForPanels(panels: VizPanel[]): TilingLayoutDocument {
  if (panels.length === 0) {
    return emptyTilingDocument();
  }

  const columnCount = Math.ceil(Math.sqrt(panels.length));
  const rows = [];

  for (let i = 0; i < panels.length; i += columnCount) {
    const views = panels
      .slice(i, i + columnCount)
      .map((panel) => tilingLayout.panel(tilingLayout.view(panel.state.key!, getViewRecord(panel))));
    rows.push(tilingLayout.row(views));
  }

  return createTilingDocument(tilingLayout.column(rows));
}

/**
 * Splits the previously added panel, alternating between right and bottom, so new panels keep a reasonable size
 * instead of becoming thin slivers along the edge.
 */
function getPlacementForNewView(document: TilingLayoutDocument, panels: VizPanel[]) {
  const lastKey = panels[panels.length - 1]?.state.key;
  const hostId = lastKey && document.root ? findDockedPanelOfView(document.root, lastKey) : undefined;

  if (!hostId) {
    return undefined;
  }

  return {
    kind: 'beside' as const,
    nodeId: hostId,
    side: panels.length % 2 === 1 ? ('right' as const) : ('bottom' as const),
  };
}

function findDockedPanelOfView(node: TilingLayoutNode, viewId: string): string | undefined {
  if (node.kind === 'panel') {
    return node.views.includes(viewId) ? node.id : undefined;
  }

  for (const child of node.children) {
    const found = findDockedPanelOfView(child, viewId);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function remapViewIds(document: TilingLayoutDocument, keyMap: Map<string, string>): TilingLayoutDocument {
  const mapId = (id: string) => keyMap.get(id) ?? id;
  const mapPanel = <T extends { views: string[]; selected: string }>(panel: T): T => ({
    ...panel,
    views: panel.views.map(mapId),
    selected: mapId(panel.selected),
  });
  const mapNode = (node: TilingLayoutNode): TilingLayoutNode =>
    node.kind === 'panel' ? mapPanel(node) : { ...node, children: node.children.map(mapNode) };

  return {
    root: document.root ? mapNode(document.root) : null,
    floating: document.floating.map((f) => ({ ...f, panel: mapPanel(f.panel) })),
    hidden: document.hidden.map((h) => ({ ...h, panel: mapPanel(h.panel) })),
    views: Object.fromEntries(Object.entries(document.views).map(([id, record]) => [mapId(id), record])),
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      // The tiling layout fills its container, so it needs a height of its own on a scrolling dashboard.
      height: 'calc(100vh - 220px)',
      minHeight: 400,
    }),
    view: css({
      width: '100%',
      height: '100%',
    }),
  };
}
