import { render, screen } from '@testing-library/react';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { getCatalogPluginMock } from 'app/features/plugins/admin/mocks/mockHelpers';

import { CardGrid, type CardGridItem } from './CardGrid';

function buildItem(overrides: Partial<CardGridItem>): CardGridItem {
  return getCatalogPluginMock(overrides);
}

describe('CardGrid', () => {
  it('fires onClickItem', async () => {
    const onClickItem = jest.fn();
    const items = [buildItem({ id: 'test-ds', name: 'Test DS', url: '/connections/datasources/test-ds' })];

    render(<CardGrid items={items} onClickItem={onClickItem} />);
    screen.getByText('Test DS').click();

    expect(onClickItem).toHaveBeenCalled();
  });

  it('renders a card with no href when the item has no url', () => {
    const items = [buildItem({ id: 'no-url', name: 'No URL Plugin', url: undefined })];

    render(<CardGrid items={items} />);
    expect(screen.queryByRole('link', { name: 'No URL Plugin' })).not.toBeInTheDocument();
  });

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

    it('prefixes a bare datasource details url with the subpath', () => {
      const items = [buildItem({ id: 'test-ds', name: 'Test DS', url: '/connections/datasources/test-ds' })];

      render(<CardGrid items={items} />);
      expect(screen.getByRole('link', { name: 'Test DS' })).toHaveAttribute(
        'href',
        '/grafana/connections/datasources/test-ds'
      );
    });

    it('prefixes a bare app plugin url with the subpath', () => {
      const items = [buildItem({ id: 'test-app', name: 'Test App', url: '/plugins/test-app' })];

      render(<CardGrid items={items} />);
      expect(screen.getByRole('link', { name: 'Test App' })).toHaveAttribute('href', '/grafana/plugins/test-app');
    });
  });
});
