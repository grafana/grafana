import { PanelPlugin } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { findVizPanelByKey } from '../utils/utils';

import { PanelOptionsPane } from './PanelOptionsPane';
import { testDashboard } from './testfiles/testDashboard';

let pluginToLoad: PanelPlugin | undefined;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => pluginToLoad),
  }),
}));

describe('PanelOptionsPane', () => {
  describe('When changing plugin', () => {
    it('Should set the cache', () => {
      const { optionsPane, panel } = setupTest('panel-1');
      panel.changePluginType = jest.fn();

      expect(panel.state.pluginId).toBe('timeseries');

      optionsPane.onChangePanelPlugin({ pluginId: 'table' });

      expect(optionsPane['_cachedPluginOptions']['timeseries']?.options).toBe(panel.state.options);
      expect(optionsPane['_cachedPluginOptions']['timeseries']?.fieldConfig).toBe(panel.state.fieldConfig);
    });

    it('When visualization suggestion is selected should update options and fieldConfig', () => {
      pluginToLoad = getPanelPlugin({
        id: 'timeseries',
      });

      pluginToLoad.useFieldConfig({
        useCustomConfig: (builder) => {
          builder.addBooleanSwitch({
            name: 'axisBorderShow',
            path: 'axisBorderShow',
            defaultValue: false,
          });
        },
      });

      const { optionsPane, panel } = setupTest('panel-1');
      panel.setState({ $data: undefined });
      panel.activate();

      optionsPane.onChangePanelPlugin({
        pluginId: 'table',
        options: { showHeader: false },
        fieldConfig: {
          defaults: { custom: { axisBorderShow: true } },
          overrides: [],
        },
      });

      expect(panel.state.options).toEqual({ showHeader: false });
      expect((panel.state.fieldConfig.defaults.custom as any).axisBorderShow).toEqual(true);
    });

    it('Should preserve correct field config', () => {
      const { optionsPane, panel } = setupTest('panel-1');

      const mockFn = jest.fn();
      panel.changePluginType = mockFn;

      const fieldConfig = panel.state.fieldConfig;

      fieldConfig.defaults = {
        ...fieldConfig.defaults,
        unit: 'flop',
        decimals: 2,
      };

      fieldConfig.overrides = [
        {
          matcher: {
            id: 'byName',
            options: 'A-series',
          },
          properties: [
            {
              id: 'displayName',
              value: 'test',
            },
          ],
        },
        {
          matcher: { id: 'byName', options: 'D-series' },
          //should be removed because it's custom
          properties: [
            {
              id: 'custom.customPropNoExist',
              value: 'google',
            },
          ],
        },
      ];

      panel.setState({ fieldConfig: fieldConfig });

      expect(panel.state.fieldConfig.defaults.color?.mode).toBe('palette-classic');
      expect(panel.state.fieldConfig.defaults.thresholds?.mode).toBe('absolute');
      expect(panel.state.fieldConfig.defaults.unit).toBe('flop');
      expect(panel.state.fieldConfig.defaults.decimals).toBe(2);
      expect(panel.state.fieldConfig.overrides).toHaveLength(2);
      expect(panel.state.fieldConfig.overrides[1].properties).toHaveLength(1);
      expect(panel.state.fieldConfig.defaults.custom).toHaveProperty('axisBorderShow');

      optionsPane.onChangePanelPlugin({ pluginId: 'table' });

      expect(mockFn).toHaveBeenCalled();
      expect(mockFn.mock.calls[0][2].defaults.color?.mode).toBe('palette-classic');
      expect(mockFn.mock.calls[0][2].defaults.thresholds?.mode).toBe('absolute');
      expect(mockFn.mock.calls[0][2].defaults.unit).toBe('flop');
      expect(mockFn.mock.calls[0][2].defaults.decimals).toBe(2);
      expect(mockFn.mock.calls[0][2].overrides).toHaveLength(2);
      //removed custom property
      expect(mockFn.mock.calls[0][2].overrides[1].properties).toHaveLength(0);
      //removed fieldConfig custom values as well
      expect(mockFn.mock.calls[0][2].defaults.custom).toStrictEqual({});
    });
  });
});

function setupTest(panelId: string) {
  const scene = transformSaveModelToScene({ dashboard: testDashboard, meta: {} });
  const panel = findVizPanelByKey(scene, panelId)!;

  const optionsPane = new PanelOptionsPane({ panelRef: panel.getRef(), listMode: OptionFilter.All, searchQuery: '' });

  // The following happens on DahsboardScene activation. For the needs of this test this activation aint needed hence we hand-call it
  // @ts-expect-error
  getDashboardSrv().setCurrent(new DashboardModelCompatibilityWrapper(scene));

  return { optionsPane, scene, panel };
}
