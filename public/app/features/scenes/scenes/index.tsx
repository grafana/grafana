import { Scene } from '../components/Scene';
import { getDemo } from './basic';
import { getFlexLayoutTest } from './flexLayout';
import { getNestedScene } from './nested';
import { getSceneWithRows } from './sceneWithRows';
import { getTimeShiftDemo } from './timeShift';
import { getTransformationNodeTest } from './transformationNode';

export function getScenes(): Scene[] {
  return [
    getDemo(),
    getFlexLayoutTest(),
    getNestedScene(),
    getSceneWithRows(),
    getTransformationNodeTest(),
    getTimeShiftDemo(),
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
