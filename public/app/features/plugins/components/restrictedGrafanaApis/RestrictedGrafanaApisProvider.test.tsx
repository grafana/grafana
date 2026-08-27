import { render, screen } from '@testing-library/react';

import { useRestrictedGrafanaApis } from '@grafana/data';
import { config } from '@grafana/runtime';

import { RestrictedGrafanaApisProvider } from './RestrictedGrafanaApisProvider';

// The exposed API set is built when RestrictedGrafanaApisProvider is first evaluated, so the
// toggle has to be on before that import runs.
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    config: {
      ...actual.config,
      featureToggles: { ...actual.config.featureToggles, restrictedPluginApis: true },
      bootData: { ...actual.config.bootData, settings: { ...actual.config.bootData.settings } },
    },
  };
});

jest.mock('./alerting/alertRuleFormSchema', () => ({
  alertingAlertRuleFormSchemaApi: { alertingAlertRuleFormSchema: { parse: jest.fn(), safeParse: jest.fn() } },
}));

jest.mock('./dashboardMutation/dashboardMutationApi', () => ({
  dashboardMutationApi: {},
}));

jest.mock('./dashboardEditor/dashboardEditorApi', () => ({
  dashboardEditorApi: {
    openDiffView: jest.fn(),
  },
}));

const PLUGIN_ID = 'grafana-assistant-app';

function ApiProbe() {
  const { dashboardEditorAPI } = useRestrictedGrafanaApis();

  if (!dashboardEditorAPI) {
    return <div data-testid="probe">unavailable</div>;
  }

  return <div data-testid="probe">{typeof dashboardEditorAPI.openDiffView}</div>;
}

function renderProvider() {
  return render(
    <RestrictedGrafanaApisProvider pluginId={PLUGIN_ID}>
      <ApiProbe />
    </RestrictedGrafanaApisProvider>
  );
}

describe('RestrictedGrafanaApisProvider', () => {
  afterEach(() => {
    config.bootData.settings.pluginRestrictedAPIsAllowList = undefined;
    config.bootData.settings.pluginRestrictedAPIsBlockList = undefined;
  });

  it('exposes the full dashboardEditorAPI contract to an allow-listed plugin', () => {
    config.bootData.settings.pluginRestrictedAPIsAllowList = { dashboardEditorAPI: [PLUGIN_ID] };

    renderProvider();

    expect(screen.getByTestId('probe')).toHaveTextContent('function');
  });

  it('does not expose dashboardEditorAPI to a plugin that is not allow-listed', () => {
    config.bootData.settings.pluginRestrictedAPIsAllowList = { dashboardEditorAPI: ['some-other-app'] };

    renderProvider();

    expect(screen.getByTestId('probe')).toHaveTextContent('unavailable');
  });

  it('does not expose dashboardEditorAPI to a blocked plugin', () => {
    config.bootData.settings.pluginRestrictedAPIsBlockList = { dashboardEditorAPI: [PLUGIN_ID] };

    renderProvider();

    expect(screen.getByTestId('probe')).toHaveTextContent('unavailable');
  });

  it('does not expose dashboardEditorAPI when neither list mentions it', () => {
    renderProvider();

    expect(screen.getByTestId('probe')).toHaveTextContent('unavailable');
  });
});
