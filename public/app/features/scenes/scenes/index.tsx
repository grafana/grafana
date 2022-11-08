import { Scene } from '../components/Scene';

import { getFlexLayoutTest, getScenePanelRepeaterTest } from './demo';
import { getGridLayoutTest } from './grid';
import { getMultipleGridLayoutTest } from './gridMultiple';
import { getGridWithRowLayoutTest } from './gridWithRow';
// import { getGridWithRowsTest } from './gridWithRows';
import { getNestedScene } from './nested';
import { getGridNestedTest } from './nestedGrid';
import { getSceneWithRows } from './sceneWithRows';

export function getScenes(): Scene[] {
  return [
    getFlexLayoutTest(),
    getScenePanelRepeaterTest(),
    getNestedScene(),
    getSceneWithRows(),
    getGridLayoutTest(),
    getGridWithRowLayoutTest(),
    getMultipleGridLayoutTest(),
    // getGridWithRowsTest(),
    getGridNestedTest(),
  ];
}

const cache: Record<string, Scene> = {};

export function getSceneByTitle(title: string) {
  if (cache[title]) {
    return cache[title];
  }

  const scene = getScenes().find((x) => x.state.title === title);
  if (scene) {
    cache[title] = scene;
  }

  return scene;
}
