import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { locationUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import PageCard from './PageCard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
  },
}));

describe('PageCard', () => {
  const originalAppSubUrl = config.appSubUrl;

  afterEach(() => {
    config.appSubUrl = originalAppSubUrl;
    locationUtil.initialize({
      config,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });
    jest.clearAllMocks();
  });

  const setup = (url: string) => {
    render(<PageCard title="Data sources" description="Manage data sources" icon="database" url={url} index={0} />);
  };

  it('navigates without duplicating the sub-path when Grafana is served under a sub-path', async () => {
    // Simulate GF_SERVER_ROOT_URL=https://example.com/grafana/
    config.appSubUrl = '/grafana';
    locationUtil.initialize({
      config,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });

    // Nav-tree urls arrive with appSubUrl already prepended by the backend
    setup('/grafana/connections/datasources');

    await userEvent.click(screen.getByRole('button'));

    // locationService's history has basename=appSubUrl, so the pushed path must be bare
    expect(locationService.push).toHaveBeenCalledWith('/connections/datasources');
  });

  it('navigates correctly when Grafana is served from the root', async () => {
    config.appSubUrl = '';
    locationUtil.initialize({
      config,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });

    setup('/connections/datasources');

    await userEvent.click(screen.getByRole('button'));

    expect(locationService.push).toHaveBeenCalledWith('/connections/datasources');
  });

  it('supports keyboard activation with Enter without duplicating the sub-path', async () => {
    config.appSubUrl = '/grafana';
    locationUtil.initialize({
      config,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });

    setup('/grafana/connections/datasources');

    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');

    expect(locationService.push).toHaveBeenCalledWith('/connections/datasources');
  });
});
