import { Subscription } from 'rxjs';

import { type AnnotationQuery, getDataSourceRef, type TimeRange } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime';
import {
  type SceneDataLayerProviderState,
  type SceneDataLayerProvider,
  SceneDataLayerSetBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectRef,
  SceneObjectBase,
  SceneQueryRunner,
  type SceneTimeRangeLike,
  type SceneTimeRangeState,
  sceneGraph,
  VizPanel,
} from '@grafana/scenes';

import { type AlertStatesDataLayer } from './AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DataLayerControl } from './DataLayerControl';
import { isRowItem, isTabItem } from './types/LayoutItemTypeGuards';

export const NEW_ANNOTATION_NAME = 'New annotation';
const NEW_ANNOTATION_COLOR = 'red';

export interface DashboardDataLayerSetState extends SceneDataLayerProviderState {
  alertStatesLayer?: AlertStatesDataLayer;
  annotationLayers: SceneDataLayerProvider[];
  panelLayers: DashboardAnnotationsDataLayer[];
}

export class DashboardDataLayerSet
  extends SceneDataLayerSetBase<DashboardDataLayerSetState>
  implements SceneDataLayerProvider
{
  public static Component = DashboardDataLayerSetRenderer;

  public constructor(state: Partial<DashboardDataLayerSetState>) {
    super({
      ...state,
      name: state.name ?? 'Data layers',
      annotationLayers: state.annotationLayers ?? [],
      panelLayers: [],
    });

    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    this._subs.add(
      this.subscribeToState((newState, oldState) => {
        if (newState.annotationLayers !== oldState.annotationLayers && this._shouldRunLayers()) {
          const previousSubscription = this.querySub;
          this.querySub = undefined;
          // Keep retained layers active so their mounted controls do not lose state subscriptions.
          this.subscribeToAllLayers(this.getAllLayers());
          previousSubscription?.unsubscribe();
        }
      })
    );

    // Tab and row headers activate every section, including inactive tabs and collapsed rows.
    // Section layers subscribe only while that section is on screen. The pause is not written to query.enable.
    this._syncSectionQueries();
    const stopWatchingSection = this._watchSectionLiveness();

    return () => {
      stopWatchingSection();
      this.querySub?.unsubscribe();
      this.querySub = undefined;
    };
  }

  private _shouldRunLayers(): boolean {
    for (const current of sectionAncestors(this)) {
      if (isTabItem(current) && !tabIsCurrent(current)) {
        return false;
      }
      if (isRowItem(current) && current.getCollapsedState()) {
        return false;
      }
    }
    return true;
  }

  private _syncSectionQueries() {
    if (this._shouldRunLayers()) {
      if (!this.querySub) {
        this.subscribeToAllLayers(this.getAllLayers());
      }
      return;
    }

    if (this.querySub) {
      this.cancelQuery();
      this.querySub = undefined;
    }
  }

  private _watchSectionLiveness(): () => void {
    const unsubs: Array<() => void> = [];

    for (const current of sectionAncestors(this)) {
      // The tabs manager holds currentTabSlug; a repeat clone's parent is its source tab, not the manager
      const tabsManager = isTabItem(current) ? skipRepeatSources(current).parent : undefined;
      if (tabsManager) {
        const sub = tabsManager.subscribeToState(() => this._syncSectionQueries());
        unsubs.push(() => sub.unsubscribe());
      }
      if (isRowItem(current)) {
        const sub = current.subscribeToState(() => this._syncSectionQueries());
        unsubs.push(() => sub.unsubscribe());
      }
    }

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }

  /**
   * Repeat clones of a row/tab are children of the source section (repeatedRows/repeatedTabs) and carry
   * their own copy of this set, so the source set must not reach panels inside those clones.
   */
  public isVisibleTo(sceneObject: SceneObject): boolean {
    // The panel's layer set supplies either these shared results or annotations queried with its time override.
    if (sceneObject instanceof SceneQueryRunner && sceneObject.state.$data instanceof PanelDataLayerSet) {
      return false;
    }

    const owner = this.parent;
    if (!owner) {
      return true;
    }

    let current: SceneObject | undefined = sceneObject;

    while (current && current !== owner) {
      if (current.parent === owner && isRepeatCloneOf(current, owner)) {
        return false;
      }
      current = current.parent;
    }

    return true;
  }

  public addAnnotationLayer(layer: SceneDataLayerProvider) {
    this.setState({ annotationLayers: [...this.state.annotationLayers, layer] });
  }

  public addPanelLayer(layer: DashboardAnnotationsDataLayer): () => void {
    this.setState({ panelLayers: [...this.state.panelLayers, layer] });
    return () => this.setState({ panelLayers: this.state.panelLayers.filter((item) => item !== layer) });
  }

  public clone(withState?: Partial<DashboardDataLayerSetState>): this {
    // Runtime copies refer to live panel time ranges and must not be cloned with the annotation definitions.
    return super.clone({ ...withState, panelLayers: [] });
  }

  public async createDefaultAnnotationLayer(): Promise<DashboardAnnotationsDataLayer> {
    const defaultDatasource = await getDataSourceInstanceSettings(null);
    const datasourceRef = defaultDatasource?.meta.annotations ? getDataSourceRef(defaultDatasource) : undefined;

    const newAnnotationQuery: AnnotationQuery = {
      enable: true,
      datasource: datasourceRef,
      name: NEW_ANNOTATION_NAME,
      iconColor: NEW_ANNOTATION_COLOR,
    };

    return new DashboardAnnotationsDataLayer({
      query: newAnnotationQuery,
      name: newAnnotationQuery.name,
      isEnabled: true,
      isHidden: false,
    });
  }

  private getAllLayers() {
    const layers = [...this.state.annotationLayers];

    if (this.state.alertStatesLayer) {
      layers.push(this.state.alertStatesLayer);
    }

    return layers;
  }
}

function DashboardDataLayerSetRenderer({ model }: SceneComponentProps<DashboardDataLayerSet>) {
  const { annotationLayers } = model.useState();

  return (
    <>
      {annotationLayers.map((layer) => (
        <DataLayerControl layer={layer} key={layer.state.key} />
      ))}
    </>
  );
}

export function isDashboardDataLayerSetState(data: unknown): data is DashboardDataLayerSetState {
  if (data && typeof data === 'object') {
    return 'annotationLayers' in data;
  }

  return false;
}

export function isDashboardDataLayerSet(obj: unknown): obj is DashboardDataLayerSet {
  return obj instanceof DashboardDataLayerSet;
}

/**
 * Ancestors of a scene object, stepping over repeat sources. A repeat clone is a child of its source
 * row/tab (repeatedRows/repeatedTabs), but the source's current/collapsed state does not apply to the clone.
 */
function* sectionAncestors(sceneObject: SceneObject): Generator<SceneObject> {
  let current = sceneObject.parent;
  while (current) {
    yield current;
    current = skipRepeatSources(current).parent;
  }
}

function skipRepeatSources(sceneObject: SceneObject): SceneObject {
  let current = sceneObject;
  while (current.parent && isRepeatCloneOf(current, current.parent)) {
    current = current.parent;
  }
  return current;
}

function isRepeatCloneOf(clone: SceneObject, source: SceneObject): boolean {
  return (
    'repeatSourceKey' in clone.state &&
    Boolean(clone.state.repeatSourceKey) &&
    clone.state.repeatSourceKey === source.state.key
  );
}

function tabIsCurrent(tab: SceneObject): boolean {
  if ('isCurrentTab' in tab && typeof tab.isCurrentTab === 'function') {
    return Boolean(tab.isCurrentTab());
  }
  return true;
}

interface PanelDataLayerSetState extends SceneDataLayerProviderState {
  layers: Array<SceneObjectRef<DashboardAnnotationsDataLayer>>;
}

/** Shared dashboard queries cannot supply annotations outside the dashboard's time range. */
export class PanelDataLayerSet extends SceneDataLayerSetBase<PanelDataLayerSetState> {
  public constructor(state: Partial<PanelDataLayerSetState> = {}) {
    super({ ...state, name: 'Panel data layers', layers: [] });
    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    let panel = this.parent;
    while (panel && !(panel instanceof VizPanel)) {
      panel = panel.parent;
    }
    if (!panel) {
      return;
    }

    const sources = sceneGraph.getDataLayers(panel).filter((layer) => layer instanceof DashboardDataLayerSet);
    let layerSubscriptions = new Subscription();

    const subscribeToLayers = () => {
      const previousQuerySub = this.querySub;
      const previousLayerSubscriptions = layerSubscriptions;
      layerSubscriptions = new Subscription();
      const layers: SceneDataLayerProvider[] = [];
      const panelLayers: DashboardAnnotationsDataLayer[] = [];
      const timeRange = sceneGraph.getTimeRange(this);

      for (const source of sources) {
        if (timeRange === sceneGraph.getTimeRange(source)) {
          layers.push(source);
          continue;
        }

        for (const annotation of source.state.annotationLayers) {
          if (!(annotation instanceof DashboardAnnotationsDataLayer)) {
            layers.push(annotation);
            continue;
          }

          const panelTimeRange = new PanelAnnotationTimeRange({ source: timeRange.getRef() });
          // Keep variable lookup and dependency notifications in the definition's scope; only the time is panel-local.
          const layer = annotation.clone({ key: undefined, data: undefined, $timeRange: panelTimeRange });
          const removeLayer = source.addPanelLayer(layer);
          panelLayers.push(layer);
          layers.push(layer);
          layerSubscriptions.add(
            annotation.subscribeToState((next, prev) => {
              if (next.query !== prev.query || next.isEnabled !== prev.isEnabled) {
                layer.setState({ query: next.query, isEnabled: next.isEnabled });
                if (next.isEnabled && next.isEnabled === prev.isEnabled) {
                  layer.runLayer();
                }
              }
            })
          );
          layerSubscriptions.add(removeLayer);
        }

        if (source.state.alertStatesLayer) {
          layers.push(source.state.alertStatesLayer);
        }
      }

      this.setState({ layers: panelLayers.map((layer) => layer.getRef()) });
      this.subscribeToAllLayers(layers);
      previousQuerySub?.unsubscribe();
      previousLayerSubscriptions.unsubscribe();
    };

    for (const source of sources) {
      this._subs.add(source.activate());
      this._subs.add(
        source.subscribeToState((next, prev) => {
          if (next.annotationLayers !== prev.annotationLayers || next.alertStatesLayer !== prev.alertStatesLayer) {
            subscribeToLayers();
          }
        })
      );
    }
    this._subs.add(
      panel.subscribeToState((next, prev) => {
        if (next.$timeRange !== prev.$timeRange) {
          subscribeToLayers();
        }
      })
    );
    subscribeToLayers();

    return () => {
      layerSubscriptions.unsubscribe();
      this.querySub?.unsubscribe();
      this.querySub = undefined;
      this.setState({ layers: [] });
    };
  }
}

interface PanelAnnotationTimeRangeState extends SceneTimeRangeState {
  source: SceneObjectRef<SceneTimeRangeLike>;
}

class PanelAnnotationTimeRange extends SceneObjectBase<PanelAnnotationTimeRangeState> implements SceneTimeRangeLike {
  public constructor(state: { source: SceneObjectRef<SceneTimeRangeLike> }) {
    const source = state.source.resolve();
    super({
      from: source.state.from,
      to: source.state.to,
      value: source.state.value,
      timeZone: source.getTimeZone(),
      source: state.source,
    });
    this.addActivationHandler(() => {
      const source = this.state.source.resolve();
      const update = (state: SceneTimeRangeState) => {
        this.setState({ from: state.from, to: state.to, value: state.value, timeZone: source.getTimeZone() });
      };
      if (this.state.value !== source.state.value) {
        update(source.state);
      }
      const subscription = source.subscribeToState(update);
      return () => subscription.unsubscribe();
    });
  }

  public getTimeZone() {
    return this.state.source.resolve().getTimeZone();
  }

  public onTimeRangeChange(timeRange: TimeRange) {
    this.state.source.resolve().onTimeRangeChange(timeRange);
  }

  public onTimeZoneChange(timeZone: string) {
    this.state.source.resolve().onTimeZoneChange(timeZone);
  }

  public onRefresh() {
    this.state.source.resolve().onRefresh();
  }
}
