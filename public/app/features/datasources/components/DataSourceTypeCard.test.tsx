import { render, screen } from '@testing-library/react';

import { getMockPlugin } from '@grafana/data/test';

import { DataSourceTypeCard } from './DataSourceTypeCard';

describe('DataSourceTypeCard', () => {
  it.each([
    {
      description: 'an existing Learn more link',
      links: [
        { name: 'Documentation', url: 'https://example.com/docs' },
        { name: 'Learn more', url: 'https://example.com/learn' },
      ],
      expectedUrl: 'https://example.com/learn',
    },
    {
      description: 'a Documentation link',
      links: [
        { name: 'Website', url: 'https://example.com' },
        { name: 'Documentation', url: 'https://example.com/docs' },
      ],
      expectedUrl: 'https://example.com/docs',
    },
    {
      description: 'the first link when Documentation is unavailable',
      links: [
        { name: 'Website', url: 'https://example.com' },
        { name: 'Query editor', url: 'https://example.com/query' },
      ],
      expectedUrl: 'https://example.com',
    },
  ])('shows Learn more using $description', ({ links, expectedUrl }) => {
    const plugin = getMockPlugin({ id: 'links-test' });
    plugin.info.links = links;

    render(<DataSourceTypeCard dataSourcePlugin={plugin} onClick={jest.fn()} />);

    const learnMoreLink = screen.getByRole('link');
    expect(learnMoreLink).toHaveTextContent('Learn more');
    expect(learnMoreLink).toHaveAttribute('href', `${expectedUrl}?utm_source=grafana_add_ds`);
  });

  it('keeps the Install now label for phantom plugin links', () => {
    const plugin = getMockPlugin({ id: 'phantom-plugin' });
    plugin.module = 'phantom';
    plugin.info.links = [{ name: 'Install now', url: '/plugins/phantom-plugin', target: '_self' }];

    render(<DataSourceTypeCard dataSourcePlugin={plugin} onClick={jest.fn()} />);

    const installLink = screen.getByRole('link');
    expect(installLink).toHaveTextContent('Install now');
    expect(installLink).toHaveAttribute('href', '/plugins/phantom-plugin?utm_source=grafana_add_ds');
  });
});
