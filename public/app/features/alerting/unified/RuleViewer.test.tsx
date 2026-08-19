import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { invalidatePluginSettingsCache } from '@grafana/runtime/internal';

import RuleViewer from './RuleViewer';
import { setupMswServer } from './mockApi';
import { addPlugin } from './mocks/server/configure';
import { alertingFactory } from './mocks/server/db';
import { prometheusAlertingPluginMeta } from './testSetup/plugins';

const prometheusDataSource = alertingFactory.dataSource.vanillaPrometheus().build();

setupMswServer();

describe('Rule Viewer page', () => {
  it('should throw an error if rule ID cannot be decoded', () => {
    // Assertions must live in the test body, not in the mock implementation — an expect() that
    // throws inside React's error logging path escapes as an uncaught exception and gets attributed
    // to whichever test is running when it surfaces.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<RuleViewer />);

    expect(screen.getByText(/Error: Rule ID is required/i)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: expect.stringContaining('Rule ID is required') }),
      expect.anything(),
      expect.anything()
    );

    consoleError.mockRestore();
  });

  it('redirects data source-managed rules to the plugin', async () => {
    invalidatePluginSettingsCache(prometheusAlertingPluginMeta.id);
    addPlugin(prometheusAlertingPluginMeta);
    const identifier = 'pri$Prometheus$namespace$group$rule$hash';

    render(
      <Routes>
        <Route path="/alerting/:sourceName/:id/view" element={<RuleViewer />} />
      </Routes>,
      { historyOptions: { initialEntries: [`/alerting/Prometheus/${identifier}/view`] } }
    );

    await waitFor(() =>
      expect(locationService.getLocation().pathname).toBe(
        `/a/grafana-prometheusalerting-app/rules/pri%24${prometheusDataSource.uid}%24namespace%24group%24rule%24hash`
      )
    );
  });
});
