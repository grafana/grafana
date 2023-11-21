import { debounce } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { SceneObject, SceneObjectRef, SceneObjectUrlValues, getUrlSyncManager, sceneUtils } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { TrailStepType } from './DataTrailsHistory';
import { RECENT_TRAILS_KEY } from './shared';

const MAX_RECENT_TRAILS = 20;

export interface SerializedTrail {
  key: string;
  history: Array<{
    urlValues: SceneObjectUrlValues;
    type: TrailStepType;
    description: string;
  }>;
}

export class TrailStore {
  private _recent: Array<SceneObjectRef<DataTrail>> = [];
  private _save;

  constructor() {
    this._loadRecent();

    this._save = debounce(() => {
      const serialized = this._recent.slice(0, MAX_RECENT_TRAILS).map((trail) => this._serializeTrail(trail.resolve()));
      localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify(serialized));
    }, 1000);
  }

  private _loadRecent() {
    this._recent = [];
    const recentTrailsItem = localStorage.getItem(RECENT_TRAILS_KEY);

    if (recentTrailsItem) {
      const recentTrails: SerializedTrail[] = JSON.parse(recentTrailsItem);
      for (const t of recentTrails) {
        // reconstruct the trail based on the the serialized history
        const trail = new DataTrail({ key: t.key });

        t.history.map((step) => {
          this._loadFromUrl(trail, step.urlValues);
          trail.state.history.state.steps.push({
            description: 'Test',
            type: step.type,
            trailState: sceneUtils.cloneSceneObjectState(trail.state, { history: trail.state.history }),
          });
        });
        this._recent.push(trail.getRef());
      }
    }
  }

  private _serializeTrail(trail: DataTrail): SerializedTrail {
    const history = trail.state.history.state.steps.map((step) => {
      const stepTrail = new DataTrail(step.trailState);
      return {
        urlValues: getUrlSyncManager().getUrlState(stepTrail),
        type: step.type,
        description: step.description,
      };
    });
    return {
      key: trail.state.key || uuidv4(),
      history,
    };
  }

  private _loadFromUrl(node: SceneObject, urlValues: SceneObjectUrlValues) {
    node.urlSync?.updateFromUrl(urlValues);
    node.forEachChild((child) => this._loadFromUrl(child, urlValues));
  }

  getRecentTrails() {
    return this._recent;
  }

  setRecentTrail(trail: DataTrail) {
    this._recent = this._recent.filter((t) => t !== trail.getRef());
    this._recent.unshift(trail.getRef());
    this._save();
  }
}

let store: TrailStore | undefined;
export function getTrailStore(): TrailStore {
  if (!store) {
    store = new TrailStore();
  }

  return store;
}
