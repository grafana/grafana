import { UrlQueryValue } from '@grafana/data';

import { SceneObjectUrlSyncConfigLike } from '../core/types';

interface SceneObjectUrlSyncConfigOptions {
  keys?: string[];
  getUrlState: () => Map<string, UrlQueryValue>;
  updateFromUrl: (values: Map<string, UrlQueryValue>) => void;
}

export class SceneObjectUrlSyncConfig implements SceneObjectUrlSyncConfigLike {
  private _keys: Set<string>;

  public constructor(private _options: SceneObjectUrlSyncConfigOptions) {
    this._keys = new Set(_options.keys);
  }

  public getKeys(): Set<string> {
    return this._keys;
  }

  public getUrlState(): Map<string, UrlQueryValue> {
    return this._options.getUrlState();
  }

  public updateFromUrl(values: Map<string, UrlQueryValue>): void {
    this._options.updateFromUrl(values);
  }
}
