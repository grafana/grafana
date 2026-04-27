import type { FieldConfigSource, PanelPluginVisualizationSuggestion } from '@grafana/data/types';
import { type VizPanel } from '@grafana/scenes';

import { dashboardEditActions } from '../edit-pane/shared';

import { createPresetApplyHandler } from './getPanelFrameOptions';

jest.mock('../edit-pane/shared', () => ({
  dashboardEditActions: { edit: jest.fn() },
}));

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
}));

const mockDashboardEditActions = jest.mocked(dashboardEditActions);

function buildPanel(fieldConfig: FieldConfigSource = { defaults: { custom: {} }, overrides: [] }) {
  return {
    state: { fieldConfig, options: {} },
    onFieldConfigChange: jest.fn(),
    onOptionsChange: jest.fn(),
  } as unknown as VizPanel;
}

function buildPreset(overrides: Partial<PanelPluginVisualizationSuggestion> = {}): PanelPluginVisualizationSuggestion {
  return {
    pluginId: 'timeseries',
    name: 'Smooth',
    hash: 'smooth-hash',
    options: {},
    fieldConfig: { defaults: { custom: { lineWidth: 1 } }, overrides: [] },
    ...overrides,
  };
}

describe('createPresetApplyHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a function', () => {
    expect(typeof createPresetApplyHandler(buildPanel())).toBe('function');
  });

  it('calls dashboardEditActions.edit with a description', () => {
    const panel = buildPanel();
    createPresetApplyHandler(panel)(buildPreset(), panel.state.fieldConfig);

    expect(mockDashboardEditActions.edit).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.any(String) })
    );
  });

  describe('perform - merges preset on top of current panel config', () => {
    it('applies preset custom fields over panel custom fields', () => {
      const panel = buildPanel({ defaults: { custom: { lineWidth: 3 } }, overrides: [] });
      const preset = buildPreset({ fieldConfig: { defaults: { custom: { lineWidth: 1 } }, overrides: [] } });
      mockDashboardEditActions.edit.mockImplementation(({ perform }) => perform());

      createPresetApplyHandler(panel)(preset, panel.state.fieldConfig);

      expect(panel.onFieldConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          defaults: expect.objectContaining({ custom: expect.objectContaining({ lineWidth: 1 }) }),
        }),
        true
      );
    });

    it('preserves panel custom fields not defined in the preset', () => {
      const panel = buildPanel({ defaults: { custom: { lineWidth: 3, axisPlacement: 'right' } }, overrides: [] });
      const preset = buildPreset({ fieldConfig: { defaults: { custom: { lineWidth: 1 } }, overrides: [] } });
      mockDashboardEditActions.edit.mockImplementation(({ perform }) => perform());

      createPresetApplyHandler(panel)(preset, panel.state.fieldConfig);

      expect(panel.onFieldConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          defaults: expect.objectContaining({ custom: expect.objectContaining({ axisPlacement: 'right' }) }),
        }),
        true
      );
    });

    it('clears stacking when the preset explicitly resets it', () => {
      const panel = buildPanel({
        defaults: { custom: { lineWidth: 3, stacking: { mode: 'normal', group: 'A' } } },
        overrides: [],
      });
      const preset = buildPreset({
        fieldConfig: { defaults: { custom: { lineWidth: 1, stacking: { mode: 'none', group: 'A' } } }, overrides: [] },
      });
      mockDashboardEditActions.edit.mockImplementation(({ perform }) => perform());

      createPresetApplyHandler(panel)(preset, panel.state.fieldConfig);

      expect(panel.onFieldConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          defaults: expect.objectContaining({
            custom: expect.objectContaining({ stacking: { mode: 'none', group: 'A' } }),
          }),
        }),
        true
      );
    });

    it('preserves non-custom panel defaults (unit, thresholds, etc.)', () => {
      const panel = buildPanel({
        defaults: { custom: {}, unit: 'bytes', min: 0 },
        overrides: [],
      });
      const preset = buildPreset({ fieldConfig: { defaults: { custom: { lineWidth: 1 } }, overrides: [] } });
      mockDashboardEditActions.edit.mockImplementation(({ perform }) => perform());

      createPresetApplyHandler(panel)(preset, panel.state.fieldConfig);

      expect(panel.onFieldConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          defaults: expect.objectContaining({ unit: 'bytes', min: 0 }),
        }),
        true
      );
    });

    it('preserves panel overrides', () => {
      const override = { matcher: { id: 'byName', options: 'A' }, properties: [{ id: 'decimals', value: 2 }] };
      const panel = buildPanel({ defaults: { custom: {} }, overrides: [override] });
      const preset = buildPreset({ fieldConfig: { defaults: { custom: { lineWidth: 1 } }, overrides: [] } });
      mockDashboardEditActions.edit.mockImplementation(({ perform }) => perform());

      createPresetApplyHandler(panel)(preset, panel.state.fieldConfig);

      expect(panel.onFieldConfigChange).toHaveBeenCalledWith(expect.objectContaining({ overrides: [override] }), true);
    });

    it('applies preset color when the preset defines one', () => {
      const panel = buildPanel({ defaults: { custom: {} }, overrides: [] });
      const presetColor = { mode: 'palette-classic' as const };
      const preset = buildPreset({
        fieldConfig: { defaults: { custom: { lineWidth: 1 }, color: presetColor }, overrides: [] },
      });
      mockDashboardEditActions.edit.mockImplementation(({ perform }) => perform());

      createPresetApplyHandler(panel)(preset, panel.state.fieldConfig);

      expect(panel.onFieldConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          defaults: expect.objectContaining({ color: presetColor }),
        }),
        true
      );
    });

    it('preserves panel color when the preset does not define one', () => {
      const panelColor = { mode: 'fixed' as const, fixedColor: 'red' };
      const panel = buildPanel({ defaults: { custom: {}, color: panelColor }, overrides: [] });
      const preset = buildPreset({ fieldConfig: { defaults: { custom: { lineWidth: 1 } }, overrides: [] } });
      mockDashboardEditActions.edit.mockImplementation(({ perform }) => perform());

      createPresetApplyHandler(panel)(preset, panel.state.fieldConfig);

      expect(panel.onFieldConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          defaults: expect.objectContaining({ color: panelColor }),
        }),
        true
      );
    });
  });

  describe('undo', () => {
    it('restores the previous fieldConfig', () => {
      const prevFieldConfig: FieldConfigSource = { defaults: { custom: { lineWidth: 2 } }, overrides: [] };
      const panel = buildPanel(prevFieldConfig);
      mockDashboardEditActions.edit.mockImplementation(({ undo }) => undo());

      createPresetApplyHandler(panel)(buildPreset(), prevFieldConfig);

      expect(panel.onFieldConfigChange).toHaveBeenCalledWith(prevFieldConfig, true);
    });
  });
});
