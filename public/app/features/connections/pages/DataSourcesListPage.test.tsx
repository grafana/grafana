import { render, screen } from 'test/test-utils';

import { DataSourcesListPage } from './DataSourcesListPage';

jest.mock('app/features/datasources/components/DataSourcesList', () => ({
  DataSourcesList: () => <div />,
}));
jest.mock('app/features/connections/components/AdvisorRedirectNotice/AdvisorRedirectNotice', () => ({
  AdvisorRedirectNotice: () => null,
}));
// The advisor pulls in the plugin-extensions singleton, which needs a started Grafana instance.
jest.mock('app/features/connections/hooks/useDatasourceAdvisorChecks', () => ({
  AdvisorCheckProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('app/features/connections/components/RunAdvisorChecksButton/RunAdvisorChecksButton', () => ({
  RunAdvisorChecksButton: () => null,
}));

// The drawer redirects here with the repository's new-pull-request URL after committing a data
// source to a branch; without the banner the change looks saved and goes no further.
describe('DataSourcesListPage', () => {
  it('shows the pull request banner after a commit to a branch', async () => {
    render(<DataSourcesListPage />, {
      historyOptions: {
        initialEntries: [
          '/connections/datasources?new_pull_request_url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2Fnew%2Fbranch&ref=datasource%2Fupdate',
        ],
      },
    });

    expect(await screen.findByRole('link', { name: /pull request/i })).toBeInTheDocument();
  });

  it('shows no banner on a normal visit', () => {
    render(<DataSourcesListPage />, { historyOptions: { initialEntries: ['/connections/datasources'] } });

    expect(screen.queryByRole('link', { name: /pull request/i })).not.toBeInTheDocument();
  });
});
