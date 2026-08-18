import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import RuleViewer from './RuleViewer';
import { DMAStatus, useDMAStatus } from './hooks/useDMAStatus';
import { alertingFactory } from './mocks/server/db';

jest.mock('./hooks/useDMAStatus', () => ({
  ...jest.requireActual('./hooks/useDMAStatus'),
  useDMAStatus: jest.fn(),
}));

const useDMAStatusMock = jest.mocked(useDMAStatus);
const prometheusDataSource = alertingFactory.dataSource.vanillaPrometheus().build();

describe('Rule Viewer page', () => {
  beforeEach(() => {
    useDMAStatusMock.mockReturnValue({ status: DMAStatus.ManagedByGrafana });
  });

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
    useDMAStatusMock.mockReturnValue({ status: DMAStatus.ManagedByPlugin });
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
