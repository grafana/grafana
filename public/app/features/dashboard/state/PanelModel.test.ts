import { PanelModel } from './PanelModel';
import { getPanelPlugin } from '../../plugins/__mocks__/pluginMocks';
import {
  FieldConfigProperty,
  identityOverrideProcessor,
  PanelProps,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  PanelData,
  DataSourceInstanceSettings,
} from '@grafana/data';
import { ComponentClass } from 'react';
import { PanelQueryRunner } from './PanelQueryRunner';
import { setDataSourceSrv } from '@grafana/runtime';

class TablePanelCtrl {}

export const mockStandardProperties = () => {
  const unit = {
    id: 'unit',
    path: 'unit',
    name: 'Unit',
    description: 'Value units',
    // @ts-ignore
    editor: () => null,
    // @ts-ignore
    override: () => null,
    process: identityOverrideProcessor,
    shouldApply: () => true,
  };

  const decimals = {
    id: 'decimals',
    path: 'decimals',
    name: 'Decimals',
    description: 'Number of decimal to be shown for a value',
    // @ts-ignore
    editor: () => null,
    // @ts-ignore
    override: () => null,
    process: identityOverrideProcessor,
    shouldApply: () => true,
  };

  const boolean = {
    id: 'boolean',
    path: 'boolean',
    name: 'Boolean',
    description: '',
    // @ts-ignore
    editor: () => null,
    // @ts-ignore
    override: () => null,
    process: identityOverrideProcessor,
    shouldApply: () => true,
  };

  return [unit, decimals, boolean];
};

standardFieldConfigEditorRegistry.setInit(() => mockStandardProperties());
standardEditorsRegistry.setInit(() => mockStandardProperties());

describe('PanelModel', () => {
  describe('when creating new panel model', () => {
    let model: any;
    let modelJson: any;
    let persistedOptionsMock;

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
        maxDataPoints: 100,
        interval: '5m',
        showColumns: true,
        targets: [{ refId: 'A' }, { noRefId: true }],
        options: persistedOptionsMock,
        fieldConfig: {
          defaults: {
            unit: 'mpg',
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'red', value: 80 },
              ],
            },
          },
          overrides: [
            {
              matcher: {
                id: '1',
                options: {},
              },
              properties: [
                {
                  id: 'thresholds',
                  value: {
                    mode: 'absolute',
                    steps: [
                      { color: 'green', value: null },
                      { color: 'red', value: 80 },
                    ],
                  },
                },
              ],
            },
          ],
        },
      };

      model = new PanelModel(modelJson);

      const panelPlugin = getPanelPlugin(
        {
          id: 'table',
        },
        (null as unknown) as ComponentClass<PanelProps>, // react
        TablePanelCtrl // angular
      );

      panelPlugin.setPanelOptions(builder => {
        builder.addBooleanSwitch({
          name: 'Show thresholds',
          path: 'showThresholds',
          defaultValue: true,
          description: '',
        });
      });

      panelPlugin.useFieldConfig({
        standardOptions: [FieldConfigProperty.Unit, FieldConfigProperty.Decimals],
        standardOptionsDefaults: {
          [FieldConfigProperty.Unit]: 'flop',
          [FieldConfigProperty.Decimals]: 2,
        },
      });
      model.pluginLoaded(panelPlugin);
    });

    it('should apply defaults', () => {
      expect(model.gridPos.h).toBe(3);
    });

    it('should apply option defaults', () => {
      expect(model.getOptions().showThresholds).toBeTruthy();
    });

    it('should change null thresholds to negative infinity', () => {
      expect(model.fieldConfig.defaults.thresholds.steps[0].value).toBe(-Infinity);
      expect(model.fieldConfig.overrides[0].properties[0].value.steps[0].value).toBe(-Infinity);
    });

    it('should apply option defaults but not override if array is changed', () => {
      expect(model.getOptions().arrayWith2Values.length).toBe(1);
    });

    it('should apply field config defaults', () => {
      setDataSourceSrv({
        getDataSourceSettingsByUid(uid: string): DataSourceInstanceSettings | undefined {
          return undefined;
        },
      } as any);
      // default unit is overriden by model
      expect(model.getFieldOverrideOptions().fieldConfig.defaults.unit).toBe('mpg');
      // default decimals are aplied
      expect(model.getFieldOverrideOptions().fieldConfig.defaults.decimals).toBe(2);
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
      beforeEach(() => {
        const newPlugin = getPanelPlugin({ id: 'graph' });
        newPlugin.setPanelOptions(builder => {
          builder.addBooleanSwitch({
            name: 'Show thresholds labels',
            path: 'showThresholdLabels',
            defaultValue: false,
            description: '',
          });
        });

        model.editSourceId = 1001;
        model.changePlugin(newPlugin);
        model.alert = { id: 2 };
      });

      it('should keep editSourceId', () => {
        expect(model.editSourceId).toBe(1001);
      });

      it('should keep maxDataPoints', () => {
        expect(model.maxDataPoints).toBe(100);
      });

      it('should keep interval', () => {
        expect(model.interval).toBe('5m');
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

    describe('restoreModel', () => {
      it('Should clean state and set properties from model', () => {
        model.restoreModel({
          title: 'New title',
          options: { new: true },
        });
        expect(model.title).toBe('New title');
        expect(model.options.new).toBe(true);
      });

      it('Should delete properties that are now gone on new model', () => {
        model.someProperty = 'value';
        model.restoreModel({
          title: 'New title',
          options: {},
        });

        expect(model.someProperty).toBeUndefined();
      });

      it('Should remove old angular panel specfic props', () => {
        model.axes = [{ prop: 1 }];
        model.thresholds = [];

        model.restoreModel({
          title: 'New title',
          options: {},
        });

        expect(model.axes).toBeUndefined();
        expect(model.thresholds).toBeUndefined();
      });

      it('Should be able to set defaults back to default', () => {
        model.transparent = true;

        model.restoreModel({});
        expect(model.transparent).toBe(false);
      });
    });

    describe('destroy', () => {
      it('Should still preserve last query result', () => {
        model.getQueryRunner().useLastResultFrom({
          getLastResult: () => ({} as PanelData),
        } as PanelQueryRunner);

        model.destroy();
        expect(model.getQueryRunner().getLastResult()).toBeDefined();
      });
    });
  });
});
