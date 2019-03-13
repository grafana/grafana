import { PanelModel } from './PanelModel';

describe('PanelModel', () => {
  describe('when creating new panel model', () => {
    let model;

    beforeEach(() => {
      model = new PanelModel({
        type: 'table',
        showColumns: true,
        targets: [{ refId: 'A' }, { noRefId: true }],
        options: {
          thresholds: [
            {
              color: '#F2495C',
              index: 1,
              value: 50,
            },
            {
              color: '#73BF69',
              index: 0,
              value: null,
            },
          ],
        },
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

    it('should restore -Infinity value for base threshold', () => {
      expect(model.options.thresholds).toEqual([
        {
          color: '#F2495C',
          index: 1,
          value: 50,
        },
        {
          color: '#73BF69',
          index: 0,
          value: -Infinity,
        },
      ]);
    });

    describe('when changing panel type', () => {
      beforeEach(() => {
        model.changeType('graph');
        model.alert = { id: 2 };
      });

      it('should remove table properties but keep core props', () => {
        expect(model.showColumns).toBe(undefined);
      });

      it('should restore table properties when changing back', () => {
        model.changeType('table');
        expect(model.showColumns).toBe(true);
      });

      it('should remove alert rule when changing type that does not support it', () => {
        model.changeType('table');
        expect(model.alert).toBe(undefined);
      });
    });

    describe('get panel options', () => {
      it('should apply defaults', () => {
        model.options = { existingProp: 10 };
        const options = model.getOptions({
          defaultProp: true,
          existingProp: 0,
        });

        expect(options.defaultProp).toBe(true);
        expect(options.existingProp).toBe(10);
        expect(model.options).toBe(options);
      });
    });
  });
});
