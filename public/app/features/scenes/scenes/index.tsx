import { Scene } from '../components/Scene';
import { demo } from './basic';
import { demoFromJSON } from './basicFromJson';
import { flexLayout } from './flexLayout';
import { flexLayoutFromJSON } from './flexLayoutFromJson';
import { basicNestedScene } from './nestedBasic';
import { nestedScene } from './nested';
import { nestedSceneFromJson } from './nestedFromJson';
import { basicNestedSceneFromJson } from './nestedBasicFromJson';
import { sceneWithRows } from './sceneWithRows';
import { sceneWithRowsFromJson } from './sceneWithRowsFromJson';
import { timeShiftScene } from './timeShift';
import { transformationsDemo } from './transformationNode';
import { transformationsDemoFromJson } from './transformationNodeFromJson';

export function getScenes(): Array<{ title: string; getScene: () => Scene }> {
  return [
    demo,
    demoFromJSON,
    flexLayout,
    flexLayoutFromJSON,
    basicNestedScene,
    basicNestedSceneFromJson,
    nestedScene,
    nestedSceneFromJson,
    sceneWithRows,
    sceneWithRowsFromJson,
    timeShiftScene,
    transformationsDemo,
    transformationsDemoFromJson,
  ];
}

const cache: Record<string, Scene> = {};

export function getSceneByTitle(title: string) {
  if (cache[title]) {
    return cache[title];
  }

  const scene = getScenes().find((x) => x.title === title);
  if (scene) {
    cache[title] = scene.getScene();
  }

  return cache[title];
}
