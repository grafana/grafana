import { render, screen } from '@testing-library/react';

import { type GrafanaConfig, locationUtil } from '@grafana/data';

import PageCard from './PageCard';

const defaultProps = {
  title: 'Data sources',
  description: 'View and manage your connected data source connections',
  icon: 'database' as const,
  index: 0,
};

describe('PageCard', () => {
  describe('with appSubUrl', () => {
    beforeAll(() => {
      locationUtil.initialize({
        config: { appSubUrl: '/grafana' } as GrafanaConfig,
        getVariablesUrlParams: jest.fn(),
        getTimeRangeForUrl: jest.fn(),
      });
    });

    afterAll(() => {
      locationUtil.initialize({
        config: { appSubUrl: '' } as GrafanaConfig,
        getVariablesUrlParams: jest.fn(),
        getTimeRangeForUrl: jest.fn(),
      });
    });

    it('renders the card link with the subpath applied exactly once, given a url already carrying it', () => {
      render(<PageCard {...defaultProps} url="/grafana/connections/datasources" />);
      expect(screen.getByRole('link', { name: 'Data sources' })).toHaveAttribute(
        'href',
        '/grafana/connections/datasources'
      );
    });
  });
});
