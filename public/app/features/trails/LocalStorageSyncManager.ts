import { debounce } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { SceneObjectRef, SceneObjectUrlValues, getUrlSyncManager, sceneUtils } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { TrailStepType } from './DataTrailsHistory';
import { RECENT_TRAILS_KEY } from './shared';

interface SerializedTrail {
  key: string;
  urlValues: SceneObjectUrlValues;
  history: Array<{
    url: SceneObjectUrlValues;
    type: TrailStepType;
    description: string;
  }>;
}

export class LocalStorageSyncManager {
  private _recent: Record<string, SceneObjectRef<DataTrail>>;
  private _save;

  constructor() {
    this._recent = {};
    const recentTrailsItem = localStorage.getItem(RECENT_TRAILS_KEY);
    if (recentTrailsItem) {
      const recentTrails: SerializedTrail[] = JSON.parse(recentTrailsItem);
      for (const t of recentTrails) {
        console.log('Loading recent trail', t);
        const trail = new DataTrail({ key: t.key });
        trail.updateFromUrl(t.urlValues);
        t.history.map((step) => {
          console.log('Loading step', step);
          const stepTrail = new DataTrail({});
          stepTrail.updateFromUrl(step.url);
          trail.state.history.state.steps.push({
            description: 'Test',
            type: step.type,
            trailState: sceneUtils.cloneSceneObjectState(trail.state, { history: trail.state.history }),
          });
        });
        this._recent[t.key] = trail.getRef();
      }
    }

    this._save = debounce(() => {
      const serialized = Object.values(this._recent).map((trail) => this.serializeTrail(trail.resolve()));
      localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify(serialized));
    }, 1000);
  }

  private serializeTrail(trail: DataTrail): SerializedTrail {
    const history = trail.state.history.state.steps.map((step) => {
      const stepTrail = new DataTrail(step.trailState);
      return {
        url: getUrlSyncManager().getUrlState(stepTrail),
        type: step.type,
        description: step.description,
      };
    });
    return {
      key: trail.state.key || uuidv4(),
      urlValues: getUrlSyncManager().getUrlState(trail),
      history,
    };
  }

  getRecentTrails() {
    return Object.values(this._recent);
  }

  setRecentTrail(trail: DataTrail) {
    console.log('Setting recent trail', trail);
    if (trail.state.key) {
      this._recent[trail.state.key] = trail.getRef();
    } else {
      console.error('Unable to set recent trail without key', trail);
    }
    this._save();
  }
}

let syncManager: LocalStorageSyncManager | undefined;
export function getLocalStorageSyncManager(): LocalStorageSyncManager {
  if (!syncManager) {
    syncManager = new LocalStorageSyncManager();
  }

  return syncManager;
}
