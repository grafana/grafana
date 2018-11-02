import _ from 'lodash';
import { PanelModel } from '../panel_model';

describe('PanelModel', () => {
  describe('when creating new panel model', () => {
    let model;

    beforeEach(() => {
      model = new PanelModel({});
    });

    it('should apply defaults', () => {
      expect(model.gridPos.h).toBe(3);
    });

    it('getSaveModel should remove defaults', () => {
      const saveModel = model.getSaveModel();
      expect(saveModel.gridPos).toBe(undefined);
    });

    it('getSaveModel should remove nonPersistedProperties', () => {
      const saveModel = model.getSaveModel();
      expect(saveModel.events).toBe(undefined);
    });

    describe('when calling applyDefaults', () => {
      beforeEach(() => {
        const defaults = {
          myName: 'My name',
          myBool1: true,
          myBool2: false,
          myNumber: 0,
          nestedObj: {
            myName: 'nested name',
            myBool1: true,
            myBool2: false,
            myNumber: 0,
          },
        };
        model.applyDefaults(defaults);
      });

      it('Should apply defaults', () => {
        expect(model.myName).toBe('My name');
        expect(model.myBool1).toBe(true);
        expect(model.myBool2).toBe(false);
        expect(model.myNumber).toBe(0);
        expect(model.nestedObj.myName).toBe('nested name');
        expect(model.nestedObj.myBool1).toBe(true);
        expect(model.nestedObj.myBool2).toBe(false);
        expect(model.nestedObj.myNumber).toBe(0);
      });

      it('getSaveModel should remove them', () => {
        const saveModel = model.getSaveModel();
        expect(saveModel.myName).toBe(undefined);
        expect(saveModel.nestedObj).toBe(undefined);
      });

      it('getSaveModel should remove only unchanged defaults', () => {
        model.myName = 'changed';
        model.nestedObj.myBool2 = true;

        const saveModel = model.getSaveModel();

        expect(saveModel.myName).toBe('changed');
        expect(saveModel.nestedObj.myBool2).toBe(true);
        expect(saveModel.nestedObj.myBool1).toBe(undefined);
      });
    });
  });
});
