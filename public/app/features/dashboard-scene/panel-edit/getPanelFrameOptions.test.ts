import { FieldConfigSource, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';

import { dashboardEditActions } from '../edit-pane/shared';

import { createPresetApplyHandler } from './getPanelFrameOptions';

jest.mock('../edit-pane/shared', () => ({
  dashboardEditActions: { edit: jest.fn() },
}));

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
}));

const mockDashboardEditActions = jest.mocked(dashboardEditActions);

const prevFieldConfig: FieldConfigSource = { defaults: { custom: { lineWidth: 2 } }, overrides: [] };
const preset: PanelPluginVisualizationSuggestion = {
  pluginId: 'timeseries',
  name: 'Smooth',
  hash: 'smooth-hash',
  options: {},
  fieldConfig: { defaults: { custom: { lineWidth: 1 } }, overrides: [] },
};

function buildPanel() {
  return {
    state: { fieldConfig: prevFieldConfig },
    onFieldConfigChange: jest.fn(),
  } as unknown as VizPanel;
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
    const onApplyPreset = createPresetApplyHandler(panel);

    onApplyPreset(preset, prevFieldConfig);

    expect(mockDashboardEditActions.edit).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.any(String) })
    );
  });

  it('calls panel.onFieldConfigChange with the preset fieldConfig on perform', () => {
    const panel = buildPanel();
    mockDashboardEditActions.edit.mockImplementation(({ perform }) => perform());

    createPresetApplyHandler(panel)(preset, prevFieldConfig);

    expect(panel.onFieldConfigChange).toHaveBeenCalledWith(preset.fieldConfig, true);
  });

  it('calls panel.onFieldConfigChange with the previous fieldConfig on undo', () => {
    const panel = buildPanel();
    mockDashboardEditActions.edit.mockImplementation(({ undo }) => undo());

    createPresetApplyHandler(panel)(preset, prevFieldConfig);

    expect(panel.onFieldConfigChange).toHaveBeenCalledWith(prevFieldConfig, true);
  });
});
