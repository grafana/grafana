import { render, screen } from '@testing-library/react';

import { type GrafanaConfig, locationUtil } from '@grafana/data';

import { DataSourceCategories } from './DataSourceCategories';

describe('DataSourceCategories', () => {
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

    it('prefixes the "Find more data source plugins" link with the subpath exactly once', () => {
      render(<DataSourceCategories categories={[]} onClickDataSourceType={jest.fn()} />);

      expect(screen.getByRole('link', { name: 'Find more data source plugins' })).toHaveAttribute(
        'href',
        '/grafana/connections/add-new-connection?cat=data-source'
      );
    });
  });
});
