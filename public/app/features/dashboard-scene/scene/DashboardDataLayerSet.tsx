import { type AnnotationQuery, getDataSourceRef } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import {
  type SceneDataLayerProviderState,
  type SceneDataLayerProvider,
  SceneDataLayerSetBase,
  type SceneComponentProps,
  type SceneObject,
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
    });

    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    this._subs.add(
      this.subscribeToState((newState, oldState) => {
        if (newState.annotationLayers !== oldState.annotationLayers && this._shouldRunLayers()) {
          this.querySub?.unsubscribe();
          this.querySub = undefined;
          this.subscribeToAllLayers(this.getAllLayers());
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
