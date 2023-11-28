import { ReplaySubject } from 'rxjs';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { SceneDataTransformer, SceneObjectBase, } from '@grafana/scenes';
import { getVizPanelKeyForPanelId } from '../utils/utils';
export class ShareQueryDataProvider extends SceneObjectBase {
    constructor(state) {
        super(state);
        this._results = new ReplaySubject();
        this.addActivationHandler(() => {
            // TODO handle changes to query model (changed panelId / withTransforms)
            //this.subscribeToState(this._onStateChanged);
            this._subscribeToSource();
            return () => {
                if (this._querySub) {
                    this._querySub.unsubscribe();
                }
                if (this._sourceDataDeactivationHandler) {
                    this._sourceDataDeactivationHandler();
                }
            };
        });
    }
    getResultsStream() {
        return this._results;
    }
    _subscribeToSource() {
        const { query } = this.state;
        if (this._querySub) {
            this._querySub.unsubscribe();
        }
        if (!query.panelId) {
            return;
        }
        const keyToFind = getVizPanelKeyForPanelId(query.panelId);
        const source = findObjectInScene(this.getRoot(), (scene) => scene.state.key === keyToFind);
        if (!source) {
            console.log('Shared dashboard query refers to a panel that does not exist in the scene');
            return;
        }
        let sourceData = source.state.$data;
        if (!sourceData) {
            console.log('No source data found for shared dashboard query');
            return;
        }
        // This will activate if sourceData is part of hidden panel
        // Also make sure the sourceData is not deactivated if hidden later
        this._sourceDataDeactivationHandler = sourceData.activate();
        if (sourceData instanceof SceneDataTransformer) {
            if (!query.withTransforms) {
                if (!sourceData.state.$data) {
                    throw new Error('No source inner query runner found in data transformer');
                }
                sourceData = sourceData.state.$data;
            }
        }
        this._querySub = sourceData.subscribeToState((state) => {
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
        this.setState({ data: sourceData.state.data });
    }
}
export function findObjectInScene(scene, check) {
    if (check(scene)) {
        return scene;
    }
    let found = null;
    scene.forEachChild((child) => {
        let maybe = findObjectInScene(child, check);
        if (maybe) {
            found = maybe;
        }
    });
    return found;
}
//# sourceMappingURL=ShareQueryDataProvider.js.map