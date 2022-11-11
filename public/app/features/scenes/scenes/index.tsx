import { Scene } from '../components/Scene';

import { getFlexLayoutTest, getScenePanelRepeaterTest } from './demo';
import { getNestedScene } from './nested';
import { getSceneWithRows } from './sceneWithRows';
import { getVariablesDemo } from './variablesDemo';

export function getScenes(): Scene[] {
  return [getFlexLayoutTest(), getScenePanelRepeaterTest(), getNestedScene(), getSceneWithRows(), getVariablesDemo()];
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
