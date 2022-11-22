import { UrlQueryValue } from '@grafana/data';

import { SceneObjectUrlSyncConfigLike } from '../core/types';

interface SceneObjectUrlSyncConfigOptions {
  keys?: string[];
  toUrlValues: () => Map<string, UrlQueryValue>;
  fromUrlValues: (values: Map<string, UrlQueryValue>) => void;
}

export class SceneObjectUrlSyncConfig implements SceneObjectUrlSyncConfigLike {
  private _keys: Set<string>;

  public constructor(private _options: SceneObjectUrlSyncConfigOptions) {
    this._keys = new Set(_options.keys);
  }

  public getKeys(): Set<string> {
    return this._keys;
  }

  public toUrlValues(): Map<string, UrlQueryValue> {
    return this._options.toUrlValues();
  }

  public fromUrlValues(values: Map<string, UrlQueryValue>): void {
    this._options.fromUrlValues(values);
  }
}
