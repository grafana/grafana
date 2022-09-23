import { SceneContextObject } from './SceneContextObject';
import { SceneObject } from './types';

export function isContextObject(node: SceneObject): node is SceneContextObject {
  return node instanceof SceneContextObject;
}
