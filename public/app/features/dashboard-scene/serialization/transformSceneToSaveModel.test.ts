import dashboard_to_load1 from './testfiles/dashboard_to_load1.json';
import { transformSaveModelToScene } from './transformSaveModelToScene';
import { transformSceneToSaveModel } from './transformSceneToSaveModel';

describe('transformSceneToSaveModel', () => {
  describe('Given a scene', () => {
    it('Should transfrom back to peristed model', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as any, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel).toMatchSnapshot();
    });
  });
});
