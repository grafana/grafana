import { Scene } from '../models/Scene';

import { getDemoScene } from './demo';
import { getNestedScene } from './nested';

export function getScenes(): Scene[] {
  return [getDemoScene(), getNestedScene()];
}
