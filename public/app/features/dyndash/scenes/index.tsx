import { Scene } from '../models/Scene';

import { getFlexLayoutTest, getScenePanelRepeaterTest } from './demo';
import { getNestedScene } from './nested';

export function getScenes(): Scene[] {
  return [getFlexLayoutTest(), getScenePanelRepeaterTest(), getNestedScene()];
}
