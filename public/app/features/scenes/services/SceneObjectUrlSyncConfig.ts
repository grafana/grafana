import { SceneObjectState, SceneObjectUrlSyncHandler, SceneObjectWithUrlSync } from '../core/types';

interface SceneObjectUrlSyncConfigOptions {
  keys?: string[];
}

export class SceneObjectUrlSyncConfig<TState extends SceneObjectState> implements SceneObjectUrlSyncHandler<TState> {
  private _keys: Set<string>;

  public constructor(private _sceneObject: SceneObjectWithUrlSync<TState>, _options: SceneObjectUrlSyncConfigOptions) {
    this._keys = new Set(_options.keys);
  }

  public getKeys(): Set<string> {
    return this._keys;
  }

  public getUrlState(state: TState): Map<string, string> {
    return this._sceneObject.getUrlState(state);
  }

  public updateFromUrl(values: Map<string, string>): void {
    this._sceneObject.updateFromUrl(values);
  }
}
