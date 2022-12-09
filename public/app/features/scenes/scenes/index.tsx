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

interface SceneDef {
  title: string;
  getScene: () => Scene;
}
export function getScenes(): SceneDef[] {
  return [
    { title: 'Flex layout test', getScene: getFlexLayoutTest },
    { title: 'Panel repeater test', getScene: getScenePanelRepeaterTest },
    { title: 'Nested Scene demo', getScene: getNestedScene },
    { title: 'Scene with rows', getScene: getSceneWithRows },
    { title: 'Grid layout test', getScene: getGridLayoutTest },
    { title: 'Grid with row layout test', getScene: getGridWithRowLayoutTest },
    { title: 'Grid with rows and different queries', getScene: getGridWithMultipleData },
    { title: 'Grid with rows and different queries and time ranges', getScene: getGridWithMultipleTimeRanges },
    { title: 'Multiple grid layouts test', getScene: getMultipleGridLayoutTest },
    { title: 'Variables', getScene: getVariablesDemo },
  ];
}

const cache: Record<string, Scene> = {};

export function getSceneByTitle(title: string, standalone = true) {
  if (cache[title]) {
    if (cache[title].state.standalone !== standalone) {
      cache[title].setState({ standalone });
    }

    return cache[title];
  }

  const scene = getScenes().find((x) => x.title === title);

  if (scene) {
    cache[title] = scene.getScene();
  }

  return cache[title];
}
