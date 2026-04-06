import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type PanelPlugin } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { VizPanel } from '@grafana/scenes';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { activateFullSceneTree } from '../utils/test-utils';
import { findVizPanelByKey } from '../utils/utils';
import * as utils from '../utils/utils';

import { PanelOptionsPane } from './PanelOptionsPane';
import { testDashboard } from './testfiles/testDashboard';

jest.spyOn(utils, 'getDashboardSceneFor').mockReturnValue(new DashboardScene({}));

const pluginWithFieldConfig = getPanelPlugin({
  id: 'TestPanel',
}).useFieldConfig({
  useCustomConfig: (b) => {
    b.addBooleanSwitch({
      name: 'CustomBool',
      path: 'CustomBool',
    });
  },
});

let pluginToLoad: PanelPlugin | undefined;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => pluginToLoad ?? pluginWithFieldConfig),
  }),
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useListedPanelPluginMetas: jest.fn().mockReturnValue({
    loading: false,
    error: undefined,
    value: [
      {
        id: 'TestPanel',
        name: 'Test Panel',
        sort: 0,
        info: { logos: { small: '' } },
      },
    ],
  }),
}));

describe('PanelOptionsPane', () => {
  describe('When changing plugin', () => {
    it('Should set the cache', () => {
      const { optionsPane, panel } = setupTest('panel-1');
      panel.changePluginType = jest.fn();

      expect(panel.state.pluginId).toBe('timeseries');

      optionsPane.onChangePanel({ pluginId: 'table' });

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

      optionsPane.onChangePanel({
        pluginId: 'table',
        options: { showHeader: false },
        fieldConfig: {
          defaults: { custom: { axisBorderShow: true } },
          overrides: [],
        },
      });

      expect(panel.state.options).toEqual({ showHeader: false });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      optionsPane.onChangePanel({ pluginId: 'table' });

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

    it('Should merge fieldConfig overrides when fieldConfig is provided in options', () => {
      const { optionsPane, panel } = setupTest('panel-1');

      const originalFieldConfig = {
        defaults: { unit: 'bytes' },
        overrides: [
          {
            matcher: { id: 'byName', options: 'A-series' },
            properties: [{ id: 'displayName', value: 'Original Override' }],
          },
        ],
      };

      panel.setState({ fieldConfig: originalFieldConfig });

      const mockOnFieldConfigChange = jest.fn();
      panel.onFieldConfigChange = mockOnFieldConfigChange;

      // Call onChangePanel with fieldConfig that has overrides
      optionsPane.onChangePanel({
        pluginId: 'table',
        fieldConfig: {
          defaults: { unit: 'percent' },
          overrides: [],
        },
      });

      // Verify onFieldConfigChange was called with merged overrides
      expect(mockOnFieldConfigChange).toHaveBeenCalled();

      const mergedConfig = mockOnFieldConfigChange.mock.calls[0][0];

      // Should have both original and new overrides
      expect(mergedConfig.overrides).toHaveLength(1);

      // First override should be from the original (filtered) fieldConfig
      expect(mergedConfig.overrides[0].matcher).toEqual({ id: 'byName', options: 'A-series' });
      expect(mergedConfig.overrides[0].properties[0].id).toBe('displayName');

      // Should preserve the user's existing standard options
      expect(mergedConfig.defaults.unit).toBe('bytes');
    });

    it('Should not call onFieldConfigChange when no fieldConfig provided', () => {
      const { optionsPane, panel } = setupTest('panel-1');

      const mockOnFieldConfigChange = jest.fn();
      panel.onFieldConfigChange = mockOnFieldConfigChange;

      // Call without fieldConfig
      optionsPane.onChangePanel({
        pluginId: 'table',
        options: { showHeader: false },
      });

      expect(mockOnFieldConfigChange).not.toHaveBeenCalled();
    });
  });

  describe('Show only overrides button', () => {
    it('Should set aria-pressed correctly when toggling', async () => {
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'TestPanel',
        title: 'Test',
        fieldConfig: { defaults: {}, overrides: [] },
      });

      new DashboardGridItem({ body: panel });

      const optionsPane = new PanelOptionsPane({
        panelRef: panel.getRef(),
        searchQuery: '',
        listMode: OptionFilter.All,
      });

      activateFullSceneTree(optionsPane);
      panel.activate();

      render(<optionsPane.Component model={optionsPane} />);

      const overridesButton = screen.getByRole('button', { name: 'Show only overrides' });
      expect(overridesButton).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(overridesButton);
      expect(overridesButton).toHaveAttribute('aria-pressed', 'true');

      await userEvent.click(overridesButton);
      expect(overridesButton).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

function setupTest(panelId: string) {
  const scene = transformSaveModelToScene({ dashboard: testDashboard, meta: {} });
  const panel = findVizPanelByKey(scene, panelId)!;

  const optionsPane = new PanelOptionsPane({
    panelRef: panel.getRef(),
    listMode: OptionFilter.All,
    searchQuery: '',
  });

  // The following happens on DahsboardScene activation. For the needs of this test this activation aint needed hence we hand-call it
  // @ts-expect-error
  getDashboardSrv().setCurrent(new DashboardModelCompatibilityWrapper(scene));

  return { optionsPane, scene, panel };
}
