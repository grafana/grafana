import { PanelModel } from './PanelModel';
import { getPanelPlugin } from '../../plugins/__mocks__/pluginMocks';
import { ConfigOverrideRule, PanelProps } from '@grafana/data';
import { ComponentClass } from 'react';

class TablePanelCtrl {}

describe('PanelModel', () => {
  describe('when creating new panel model', () => {
    let model: any;
    let modelJson: any;
    let persistedOptionsMock;
    const defaultOptionsMock = {
      fieldOptions: {
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
      arrayWith2Values: [{ value: 'name' }, { value: 'name2' }],
      showThresholds: true,
    };

    beforeEach(() => {
      persistedOptionsMock = {
        fieldOptions: {
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
        arrayWith2Values: [{ name: 'changed to only one value' }],
      };

      modelJson = {
        type: 'table',
        showColumns: true,
        targets: [{ refId: 'A' }, { noRefId: true }],
        options: persistedOptionsMock,
        fieldConfig: {
          defaults: {
            unit: 'mpg',
          },
          overrides: [
            {
              matcher: {
                id: '1',
                options: {},
              },
              properties: [],
            },
          ],
        },
      };

      model = new PanelModel(modelJson);
      const overrideMock: ConfigOverrideRule = {
        matcher: {
          id: '2',
          options: {},
        },
        properties: [],
      };

      const panelPlugin = getPanelPlugin(
        {
          id: 'table',
        },
        (null as unknown) as ComponentClass<PanelProps>, // react
        TablePanelCtrl // angular
      );
      panelPlugin.setDefaults(defaultOptionsMock);
      panelPlugin.setFieldConfigDefaults({
        defaults: {
          unit: 'flop',
          decimals: 2,
        },
        overrides: [overrideMock],
      });
      model.pluginLoaded(panelPlugin);
    });

    it('should apply defaults', () => {
      expect(model.gridPos.h).toBe(3);
    });

    it('should apply option defaults', () => {
      expect(model.getOptions().showThresholds).toBeTruthy();
    });

    it('should apply option defaults but not override if array is changed', () => {
      expect(model.getOptions().arrayWith2Values.length).toBe(1);
    });

    it('should merge override field config options', () => {
      expect(model.getFieldOverrideOptions().fieldOptions.overrides.length).toBe(2);
    });

    it('should apply field config defaults', () => {
      // default unit is overriden by model
      expect(model.getFieldOverrideOptions().fieldOptions.defaults.unit).toBe('mpg');
      // default decimals are aplied
      expect(model.getFieldOverrideOptions().fieldOptions.defaults.decimals).toBe(2);
    });

    it('should set model props on instance', () => {
      expect(model.showColumns).toBe(true);
    });

    it('should add missing refIds', () => {
      expect(model.targets[1].refId).toBe('B');
    });

    it("shouldn't break panel with non-array targets", () => {
      modelJson.targets = {
        0: { refId: 'A' },
        foo: { bar: 'baz' },
      };
      model = new PanelModel(modelJson);
      expect(model.targets[0].refId).toBe('A');
    });

    it('getSaveModel should remove defaults', () => {
      const saveModel = model.getSaveModel();
      expect(saveModel.gridPos).toBe(undefined);
    });

    it('getSaveModel should not remove datasource default', () => {
      const saveModel = model.getSaveModel();
      expect(saveModel.datasource).toBe(null);
    });

    it('getSaveModel should remove nonPersistedProperties', () => {
      const saveModel = model.getSaveModel();
      expect(saveModel.events).toBe(undefined);
    });

    describe('variables interpolation', () => {
      beforeEach(() => {
        model.scopedVars = {
          aaa: { value: 'AAA', text: 'upperA' },
          bbb: { value: 'BBB', text: 'upperB' },
        };
      });
      it('should interpolate variables', () => {
        const out = model.replaceVariables('hello $aaa');
        expect(out).toBe('hello AAA');
      });

      it('should prefer the local variable value', () => {
        const extra = { aaa: { text: '???', value: 'XXX' } };
        const out = model.replaceVariables('hello $aaa and $bbb', extra);
        expect(out).toBe('hello XXX and BBB');
      });
    });

    describe('when changing panel type', () => {
      const newPanelPluginDefaults = {
        showThresholdLabels: false,
      };

      beforeEach(() => {
        const newPlugin = getPanelPlugin({ id: 'graph' });
        newPlugin.setDefaults(newPanelPluginDefaults);
        model.changePlugin(newPlugin);
        model.alert = { id: 2 };
      });

      it('should apply next panel option defaults', () => {
        expect(model.getOptions().showThresholdLabels).toBeFalsy();
        expect(model.getOptions().showThresholds).toBeUndefined();
      });

      it('should remove table properties but keep core props', () => {
        expect(model.showColumns).toBe(undefined);
      });

      it('should restore table properties when changing back', () => {
        model.changePlugin(getPanelPlugin({ id: 'table' }));
        expect(model.showColumns).toBe(true);
      });

      it('should remove alert rule when changing type that does not support it', () => {
        model.changePlugin(getPanelPlugin({ id: 'table' }));
        expect(model.alert).toBe(undefined);
      });
    });

    describe('when changing to react panel from angular panel', () => {
      let panelQueryRunner: any;

      const onPanelTypeChanged = jest.fn();
      const reactPlugin = getPanelPlugin({ id: 'react' }).setPanelChangeHandler(onPanelTypeChanged as any);

      beforeEach(() => {
        model.changePlugin(reactPlugin);
        panelQueryRunner = model.getQueryRunner();
      });

      it('should call react onPanelTypeChanged', () => {
        expect(onPanelTypeChanged.mock.calls.length).toBe(1);
        expect(onPanelTypeChanged.mock.calls[0][1]).toBe('table');
        expect(onPanelTypeChanged.mock.calls[0][2].angular).toBeDefined();
      });

      it('getQueryRunner() should return same instance after changing to another react panel', () => {
        model.changePlugin(getPanelPlugin({ id: 'react2' }));
        const sameQueryRunner = model.getQueryRunner();
        expect(panelQueryRunner).toBe(sameQueryRunner);
      });
    });

    describe('variables interpolation', () => {
      let panelQueryRunner: any;

      const onPanelTypeChanged = jest.fn();
      const reactPlugin = getPanelPlugin({ id: 'react' }).setPanelChangeHandler(onPanelTypeChanged as any);

      beforeEach(() => {
        model.changePlugin(reactPlugin);
        panelQueryRunner = model.getQueryRunner();
      });

      it('should call react onPanelTypeChanged', () => {
        expect(onPanelTypeChanged.mock.calls.length).toBe(1);
        expect(onPanelTypeChanged.mock.calls[0][1]).toBe('table');
        expect(onPanelTypeChanged.mock.calls[0][2].angular).toBeDefined();
      });

      it('getQueryRunner() should return same instance after changing to another react panel', () => {
        model.changePlugin(getPanelPlugin({ id: 'react2' }));
        const sameQueryRunner = model.getQueryRunner();
        expect(panelQueryRunner).toBe(sameQueryRunner);
      });
    });
  });
});
