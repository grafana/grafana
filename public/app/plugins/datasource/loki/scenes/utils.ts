import { DataFrame, ScopedVar } from '@grafana/data';
import { isSceneObject, sceneGraph } from '@grafana/scenes';

export const getDataFrameFromSerializedSceneObject = (
  serializedSceneObject: ScopedVar<unknown> | undefined,
  refId: string
) => {
  console.log('called getDataFrameFromSerializedSceneObject');
  let dataFrame: DataFrame | undefined = undefined;
  if (serializedSceneObject) {
    try {
      const scene = serializedSceneObject.valueOf();
      if (isSceneObject(scene)) {
        const $data = sceneGraph.getData(scene);
        // instanceOf checks always fail for these unserialized scene objects
        if ($data.constructor.name === 'SceneQueryRunner') {
          const dataFrames = $data.state?.data?.series;
          dataFrame = dataFrames?.find((frame) => frame.refId === refId);
        }
      }
    } catch (e) {
      console.warn('Unable to parse scene object', e);
    }
  }
  return dataFrame;
};
