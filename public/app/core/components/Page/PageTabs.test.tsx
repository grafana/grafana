import { render, screen } from '@testing-library/react';

import { type GrafanaConfig, locationUtil, type NavModelItem } from '@grafana/data';

import { PageTabs } from './PageTabs';

describe('PageTabs', () => {
  it('should render a tab with a counter', () => {
    const navItem: NavModelItem = {
      text: 'My page',
      children: [
        {
          text: 'My tab',
          tabCounter: 10,
        },
      ],
    };

    render(<PageTabs navItem={navItem} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('should render a tab with no url as a button with no href', () => {
    const navItem: NavModelItem = {
      text: 'My page',
      children: [{ text: 'My tab' }],
    };

    render(<PageTabs navItem={navItem} />);
    const tab = screen.getByRole('tab', { name: 'My tab' });
    expect(tab.tagName).toBe('BUTTON');
    expect(tab).not.toHaveAttribute('href');
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

    it('prefixes a bare tab url with the subpath', () => {
      const navItem: NavModelItem = {
        text: 'My page',
        children: [{ text: 'My tab', url: '/my-page/tab' }],
      };

      render(<PageTabs navItem={navItem} />);
      expect(screen.getByRole('tab', { name: 'My tab' })).toHaveAttribute('href', '/grafana/my-page/tab');
    });

    it('does not double-prefix a tab url that already carries the subpath', () => {
      const navItem: NavModelItem = {
        text: 'My page',
        children: [{ text: 'My tab', url: '/grafana/my-page/tab' }],
      };

      render(<PageTabs navItem={navItem} />);
      expect(screen.getByRole('tab', { name: 'My tab' })).toHaveAttribute('href', '/grafana/my-page/tab');
    });
  });
});
