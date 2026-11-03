import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { map } from 'rxjs';
import { render } from 'test/test-utils';

import {
  type DataFrame,
  type DataTransformerConfig,
  DataTransformerID,
  type DataTransformerInfo,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  type PanelPlugin,
  toDataFrame,
} from '@grafana/data';
import { mergeTransformer, mockTransformationsRegistry, sortByTransformer } from '@grafana/data/internal';
import { getPanelPlugin } from '@grafana/data/test';
import { SceneDataNode, SceneDataTransformer, VizPanel } from '@grafana/scenes';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { findVizPanelByKey } from '../utils/findVizPanel';
import { activateFullSceneTree } from '../utils/test-utils';
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

    it('Should use plugin preferred color when suggestion has no color', () => {
      const { optionsPane, panel } = setupTest('panel-1');

      const mockOnFieldConfigChange = jest.fn();
      panel.onFieldConfigChange = mockOnFieldConfigChange;

      optionsPane.onChangePanel({
        pluginId: 'table',
        fieldConfig: {
          defaults: { custom: { someProp: true } },
          overrides: [],
        },
      });

      expect(mockOnFieldConfigChange).toHaveBeenCalled();
      const mergedConfig = mockOnFieldConfigChange.mock.calls[0][0];

      expect(mergedConfig.defaults.color?.mode).toBe('thresholds');
    });

    it('Should adapt color to preferred scheme even for same-plugin suggestions', () => {
      const { optionsPane, panel } = setupTest('panel-1');

      expect(panel.state.fieldConfig.defaults.color?.mode).toBe('palette-classic');

      const mockOnFieldConfigChange = jest.fn();
      panel.onFieldConfigChange = mockOnFieldConfigChange;

      optionsPane.onChangePanel({
        pluginId: panel.state.pluginId,
        fieldConfig: {
          defaults: { custom: {} },
          overrides: [],
        },
      });

      expect(mockOnFieldConfigChange).toHaveBeenCalled();
      const mergedConfig = mockOnFieldConfigChange.mock.calls[0][0];

      expect(mergedConfig.defaults.color?.mode).toBe('thresholds');
    });

    it('Should use plugin preferred color over any current user color when suggestion has no color', () => {
      const { optionsPane, panel } = setupTest('panel-1');

      panel.setState({
        fieldConfig: {
          defaults: { ...panel.state.fieldConfig.defaults, color: { mode: 'fixed', fixedColor: 'blue' } },
          overrides: [],
        },
      });

      const mockOnFieldConfigChange = jest.fn();
      panel.onFieldConfigChange = mockOnFieldConfigChange;

      optionsPane.onChangePanel({
        pluginId: 'table',
        fieldConfig: {
          defaults: { custom: {} },
          overrides: [],
        },
      });

      expect(mockOnFieldConfigChange).toHaveBeenCalled();
      const mergedConfig = mockOnFieldConfigChange.mock.calls[0][0];
      expect(mergedConfig.defaults.color?.mode).toBe('thresholds');
    });

    it('Should apply color from suggestion fieldConfig when explicitly provided', () => {
      const { optionsPane, panel } = setupTest('panel-1');

      const mockOnFieldConfigChange = jest.fn();
      panel.onFieldConfigChange = mockOnFieldConfigChange;

      optionsPane.onChangePanel({
        pluginId: 'table',
        fieldConfig: {
          defaults: { color: { mode: 'thresholds' } },
          overrides: [],
        },
      });

      expect(mockOnFieldConfigChange).toHaveBeenCalled();
      const mergedConfig = mockOnFieldConfigChange.mock.calls[0][0];

      expect(mergedConfig.defaults.color?.mode).toBe('thresholds');
    });

    it('Should not call onFieldConfigChange when no fieldConfig provided', () => {
      const { optionsPane, panel } = setupTest('panel-1');

      const mockOnFieldConfigChange = jest.fn();
      panel.onFieldConfigChange = mockOnFieldConfigChange;

      optionsPane.onChangePanel({
        pluginId: 'table',
        options: { showHeader: false },
      });

      expect(mockOnFieldConfigChange).not.toHaveBeenCalled();
    });

    describe('with a suggestion that has transformations', () => {
      const merge: DataTransformerConfig = { id: DataTransformerID.merge, options: {} };
      const sort: DataTransformerConfig = { id: DataTransformerID.sortBy, options: { sort: [{ field: 'Time' }] } };
      const dropFrameC: DataTransformerInfo = {
        id: 'dropFrameC',
        name: 'Drop frame C',
        description: '',
        operator: () => (source) => source.pipe(map((frames) => frames.filter(({ refId }) => refId !== 'C'))),
      };
      const existing: DataTransformerConfig = { id: dropFrameC.id, options: {} };

      function frame(refId: string, name: string, values: number[]): DataFrame {
        return toDataFrame({
          refId,
          fields: [
            { name: 'Time', type: FieldType.time, values: [1000, 2000] },
            { name, type: FieldType.number, values },
          ],
        });
      }

      function panelData(series: DataFrame[]): PanelData {
        return { series, state: LoadingState.Done, timeRange: getDefaultTimeRange() };
      }

      function setupWithData(series: DataFrame[], transformations: DataTransformerConfig[] = []) {
        const source = new SceneDataNode({ data: panelData(series) });
        const transformer = new SceneDataTransformer({ $data: source, transformations });
        const panel = new VizPanel({
          key: 'panel-1',
          pluginId: 'TestPanel',
          title: 'Test',
          fieldConfig: { defaults: {}, overrides: [] },
          $data: transformer,
        });
        new DashboardGridItem({ body: panel });
        const optionsPane = new PanelOptionsPane({
          panelRef: panel.getRef(),
          listMode: OptionFilter.All,
          searchQuery: '',
        });
        source.activate();
        transformer.activate();

        return { optionsPane, panel, source, transformer };
      }

      function columns(series?: DataFrame[]) {
        return series?.map((frame) => frame.fields.map((field) => [field.name, ...field.values]));
      }

      beforeAll(() => {
        mockTransformationsRegistry([mergeTransformer, sortByTransformer, dropFrameC]);
      });

      it('runs the panel through them', async () => {
        const { optionsPane, transformer } = setupWithData([frame('A', 'CPU', [1, 2]), frame('B', 'Memory', [3, 4])]);

        expect(transformer.state.data?.series).toHaveLength(2);

        optionsPane.onChangePanel({ pluginId: 'TestPanel', transformations: [merge, sort] });

        expect(transformer.state.transformations).toEqual([merge, sort]);
        await waitFor(() =>
          expect(columns(transformer.state.data?.series)).toEqual([
            [
              ['Time', 1000, 2000],
              ['CPU', 1, 2],
              ['Memory', 3, 4],
            ],
          ])
        );
      });

      it('runs them after the transformations the panel already has, which it keeps', async () => {
        const { optionsPane, transformer } = setupWithData(
          [frame('A', 'CPU', [1, 2]), frame('B', 'Memory', [3, 4]), frame('C', 'Disk', [5, 6])],
          [existing]
        );
        await waitFor(() => expect(transformer.state.data?.series).toHaveLength(2));

        optionsPane.onChangePanel({ pluginId: 'TestPanel', transformations: [merge, sort] });

        expect(transformer.state.transformations).toEqual([existing, merge, sort]);
        await waitFor(() =>
          expect(columns(transformer.state.data?.series)).toEqual([
            [
              ['Time', 1000, 2000],
              ['CPU', 1, 2],
              ['Memory', 3, 4],
            ],
          ])
        );
      });

      it('keeps running them over new query results', async () => {
        const { optionsPane, source, transformer } = setupWithData([
          frame('A', 'CPU', [1, 2]),
          frame('B', 'Memory', [3, 4]),
        ]);

        optionsPane.onChangePanel({ pluginId: 'TestPanel', transformations: [merge, sort] });
        await waitFor(() => expect(transformer.state.data?.series).toHaveLength(1));

        source.setState({ data: panelData([frame('A', 'CPU', [7, 8]), frame('B', 'Memory', [9, 10])]) });

        await waitFor(() =>
          expect(columns(transformer.state.data?.series)).toEqual([
            [
              ['Time', 1000, 2000],
              ['CPU', 7, 8],
              ['Memory', 9, 10],
            ],
          ])
        );
      });

      it('leaves the transformations alone for a suggestion without any', () => {
        const { optionsPane, transformer } = setupWithData([frame('A', 'CPU', [1, 2])], [existing]);
        const { transformations } = transformer.state;
        const reprocess = jest.spyOn(transformer, 'reprocessTransformations');

        optionsPane.onChangePanel({ pluginId: 'TestPanel', options: {} });

        expect(transformer.state.transformations).toBe(transformations);
        expect(reprocess).not.toHaveBeenCalled();
      });
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
