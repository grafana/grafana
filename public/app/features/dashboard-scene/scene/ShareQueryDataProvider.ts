import { Observable, ReplaySubject, Unsubscribable } from 'rxjs';

import { getDefaultTimeRange, LoadingState, PanelData } from '@grafana/data';
import {
  SceneDataProvider,
  SceneDataProviderResult,
  SceneDataState,
  SceneDataTransformer,
  SceneDeactivationHandler,
  SceneObject,
  SceneObjectBase,
} from '@grafana/scenes';
import { DashboardQuery } from 'app/plugins/datasource/dashboard/types';

import { PanelEditor } from '../panel-edit/PanelEditor';
import { getVizPanelKeyForPanelId } from '../utils/utils';

export interface ShareQueryDataProviderState extends SceneDataState {
  query: DashboardQuery;
}

export class ShareQueryDataProvider extends SceneObjectBase<ShareQueryDataProviderState> implements SceneDataProvider {
  private _querySub: Unsubscribable | undefined;
  private _sourceDataDeactivationHandler?: SceneDeactivationHandler;
  private _results = new ReplaySubject<SceneDataProviderResult>();
  private _sourceProvider?: SceneDataProvider;
  private _passContainerWidth = false;

  constructor(state: ShareQueryDataProviderState) {
    super({
      data: emptyPanelData,
      ...state,
    });

    this.addActivationHandler(this._onActivate);
  }

  // Will detect the root of the scene and if it's a PanelEditor, it will clone the data from the source panel.
  // We are doing it because the source panel's original scene (dashboard) does not exist in the edit mode.
  private _setupEditMode(panelId: number, root: PanelEditor) {
    const keyToFind = getVizPanelKeyForPanelId(panelId);
    const source = findObjectInScene(
      root.state.dashboardRef.resolve(),
      (scene: SceneObject) => scene.state.key === keyToFind
    );

    if (source) {
      // Indicate that when de-activated, i.e. navigating back to dashboard, the cloned$data state needs to be removed
      // so that the panel on the dashboar can use data from the actual source panel.
      this.setState({
        $data: source.state.$data!.clone(),
      });
    }
  }

  private _onActivate = () => {
    const root = this.getRoot();
    if (root instanceof PanelEditor && this.state.query.panelId) {
      this._setupEditMode(this.state.query.panelId, root);
    }
    // TODO handle changes to query model (changed panelId / withTransforms)
    this.subscribeToState(this._onStateChanged);
    /**
     * If the panel uses a shared query, we clone the source runner and attach it as a data provider for the shared one.
     * This way the source panel does not to be present in the edit scene hierarchy.
     */

    this._subscribeToSource();

    return () => {
      if (this._querySub) {
        this._querySub.unsubscribe();
      }
      if (this._sourceDataDeactivationHandler) {
        this._sourceDataDeactivationHandler();
        this._sourceDataDeactivationHandler = undefined;
      }
    };
  };

  public getResultsStream(): Observable<SceneDataProviderResult> {
    return this._results;
  }

  private _subscribeToSource() {
    const { query } = this.state;

    if (this._querySub) {
      this._querySub.unsubscribe();
    }

    if (this._sourceDataDeactivationHandler) {
      this._sourceDataDeactivationHandler();
      this._sourceDataDeactivationHandler = undefined;
    }

    if (this.state.$data) {
      this._sourceProvider = this.state.$data;
      this._passContainerWidth = true;
    } else {
      if (!query.panelId) {
        return;
      }

      const keyToFind = getVizPanelKeyForPanelId(query.panelId);
      const source = findObjectInScene(this.getRoot(), (scene: SceneObject) => scene.state.key === keyToFind);

      if (!source) {
        console.log('Shared dashboard query refers to a panel that does not exist in the scene');
        return;
      }

      this._sourceProvider = source.state.$data;
      if (!this._sourceProvider) {
        console.log('No source data found for shared dashboard query');
        return;
      }
    }

    // If the source is not active we need to pass the container width
    if (!this._sourceProvider.isActive) {
      this._passContainerWidth = true;
    }

    // This will activate if sourceData is part of hidden panel
    // Also make sure the sourceData is not deactivated if hidden later
    this._sourceDataDeactivationHandler = this._sourceProvider.activate();

    // If source is a data transformer we might need to get the inner query runner instead depending on withTransforms option
    if (this._sourceProvider instanceof SceneDataTransformer && !query.withTransforms) {
      if (!this._sourceProvider.state.$data) {
        throw new Error('No source inner query runner found in data transformer');
      }
      this._sourceProvider = this._sourceProvider.state.$data;
    }

    this._querySub = this._sourceProvider.subscribeToState((state) => {
      this._results.next({
        origin: this,
        data: state.data || {
          state: LoadingState.Done,
          series: [],
          timeRange: getDefaultTimeRange(),
        },
      });

      this.setState({ data: state.data });
    });

    // Copy the initial state
    this.setState({ data: this._sourceProvider.state.data || emptyPanelData });
  }

  private _onStateChanged = (n: ShareQueryDataProviderState, p: ShareQueryDataProviderState) => {
    const root = this.getRoot();
    // If the query changed, we need to find the new source panel and subscribe to it
    if (n.query !== p.query && n.query.panelId) {
      if (root instanceof PanelEditor) {
        this._setupEditMode(n.query.panelId, root);
      }
      this._subscribeToSource();
    }
  };

  public setContainerWidth(width: number) {
    if (this._passContainerWidth && this._sourceProvider) {
      this._sourceProvider.setContainerWidth?.(width);
    }
  }

  public isDataReadyToDisplay() {
    if (this._sourceProvider && this._sourceProvider.isDataReadyToDisplay) {
      return this._sourceProvider.isDataReadyToDisplay();
    }
    return false;
  }
}

export function findObjectInScene(scene: SceneObject, check: (scene: SceneObject) => boolean): SceneObject | null {
  if (check(scene)) {
    return scene;
  }

  let found: SceneObject | null = null;

  scene.forEachChild((child) => {
    let maybe = findObjectInScene(child, check);
    if (maybe) {
      found = maybe;
    }
  });

  return found;
}

const emptyPanelData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
