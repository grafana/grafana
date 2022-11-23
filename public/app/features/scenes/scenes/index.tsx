import { Scene } from '../components/Scene';

import { getFlexLayoutTest, getScenePanelRepeaterTest } from './demo';
import { getGridLayoutTest } from './grid';
import { getGridWithMultipleTimeRanges } from './gridMultiTimeRange';
import { getMultipleGridLayoutTest } from './gridMultiple';
import { getGridWithMultipleData } from './gridWithMultipleData';
import { getGridWithRowLayoutTest } from './gridWithRow';
import { getNestedScene } from './nested';
import { getSceneWithRows } from './sceneWithRows';
import { getVariablesDemo } from './variablesDemo';

export function getScenes(): Scene[] {
  return [
    getFlexLayoutTest(),
    getScenePanelRepeaterTest(),
    getNestedScene(),
    getSceneWithRows(),
    getGridLayoutTest(),
    getGridWithRowLayoutTest(),
    getGridWithMultipleData(),
    getGridWithMultipleTimeRanges(),
    getMultipleGridLayoutTest(),
    getVariablesDemo(),
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
