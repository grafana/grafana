import _ from 'lodash';
import { PanelModel } from '../panel_model';

describe('PanelModel', () => {
  describe('when creating new panel model', () => {
    let model;

    beforeEach(() => {
      model = new PanelModel({
        type: 'table',
        showColumns: true,
        targets: [
          {refId: 'A'},
          {noRefId: true}
        ]
      });
    });

    it('should apply defaults', () => {
      expect(model.gridPos.h).toBe(3);
    });

    it('should set model props on instance', () => {
      expect(model.showColumns).toBe(true);
    });

    it('should add missing refIds', () => {
      expect(model.targets[1].refId).toBe('B');
    });

    it('getSaveModel should remove defaults', () => {
      const saveModel = model.getSaveModel();
      expect(saveModel.gridPos).toBe(undefined);
    });

    it('getSaveModel should remove nonPersistedProperties', () => {
      const saveModel = model.getSaveModel();
      expect(saveModel.events).toBe(undefined);
    });

    describe('when changing panel type', () => {
      beforeEach(() => {
        model.changeType('graph', true);
        model.alert = { id: 2 };
      });

      it('should remove table properties but keep core props', () => {
        expect(model.showColumns).toBe(undefined);
      });

      it('should restore table properties when changing back', () => {
        model.changeType('table', true);
        expect(model.showColumns).toBe(true);
      });

      it('should remove alert rule when changing type that does not support it', () => {
        model.changeType('table', true);
        expect(model.alert).toBe(undefined);
      });
    });
  });
});
