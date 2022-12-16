import { SceneObjectState } from './types';

class SceneObjectsCache {
  private _cache: Map<string, SceneObjectState> = new Map();

  public set<TState extends SceneObjectState>(state: TState) {
    if (!state.cacheKey) {
      return;
    }

    this._cache.set(state.cacheKey, state);
  }

  private get(key: string): SceneObjectState | undefined {
    return this._cache.get(key);
  }

  public getInitialState<TState extends SceneObjectState = SceneObjectState>(state: TState) {
    // if no cache key, skip and return frozen state
    if (!state.cacheKey) {
      return Object.freeze(state);
    }

    const cached = this.get(state.cacheKey);

    // If no cached object, set the state in cache and return frozen state
    if (!cached) {
      const toCache = Object.freeze(state);
      this.set(toCache);
      return toCache;
    }

    // If cached, get last state and update key
    return Object.freeze({ ...cached, key: state.key }) as TState;
  }
}

let cacheInstance: SceneObjectsCache;

export function getSceneObjectsCache(): SceneObjectsCache {
  if (!cacheInstance) {
    cacheInstance = new SceneObjectsCache();
  }
  return cacheInstance;
}
