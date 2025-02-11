import {
  SceneDataNode,
  SceneDataTransformer,
  SceneDeactivationHandler,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneVariable,
  SceneVariableSet,
  TextBoxVariable,
} from '@grafana/scenes';
import { DataTransformerConfig, LoadingState } from '@grafana/schema';

import { DataFrame } from '../../types/dataFrame';
import { getDefaultTimeRange } from '../../types/time';

class TestSceneObject extends SceneObjectBase<{}> {}

function activateFullSceneTree(scene: SceneObject): SceneDeactivationHandler {
  const deactivationHandlers: SceneDeactivationHandler[] = [];

  // Important that variables are activated before other children
  if (scene.state.$variables) {
    deactivationHandlers.push(activateFullSceneTree(scene.state.$variables));
  }

  scene.forEachChild((child) => {
    // For query runners which by default use the container width for maxDataPoints calculation we are setting a width.
    // In real life this is done by the React component when VizPanel is rendered.
    if ('setContainerWidth' in child) {
      // @ts-expect-error
      child.setContainerWidth(500);
    }
    deactivationHandlers.push(activateFullSceneTree(child));
  });

  deactivationHandlers.push(scene.activate());

  return () => {
    for (const handler of deactivationHandlers) {
      handler();
    }
  };
}

export function setupTransformationScene(
  inputData: DataFrame,
  cfg: DataTransformerConfig,
  variables: SceneVariable[]
): DataFrame[] {
  const dataNode = new SceneDataNode({
    data: {
      state: LoadingState.Loading,
      timeRange: getDefaultTimeRange(),
      series: [inputData],
    },
  });

  const transformationNode = new SceneDataTransformer({
    transformations: [cfg],
  });

  const consumer = new TestSceneObject({
    $data: transformationNode,
  });

  const scene = new SceneFlexLayout({
    $data: dataNode,
    $variables: new SceneVariableSet({ variables }),
    children: [new SceneFlexItem({ body: consumer })],
  });

  activateFullSceneTree(scene);

  return sceneGraph.getData(consumer).state.data?.series!;
}
