import { SceneObjectState, SceneObjectBase } from '@grafana/scenes';
import { QueryGroupOptions } from 'app/types';

export interface PanelQueryCachingOptionsBehaviorState extends SceneObjectState {
  cacheTimeout: QueryGroupOptions['cacheTimeout'];
  queryCachingTTL: QueryGroupOptions['queryCachingTTL'];
}

export class PanelQueryCachingOptionsBehavior extends SceneObjectBase<PanelQueryCachingOptionsBehaviorState> {}
