import React from 'react';
import PageHeader from './PageHeader';
import { render } from '@testing-library/react';

describe('PageHeader', () => {
  describe('when the nav tree has a node with a title', () => {
    it('should render the title', async () => {
      const nav = {
        main: {
          icon: 'folder-open',
          id: 'node',
          subTitle: 'node subtitle',
          url: '',
          text: 'node',
        },
        node: {},
      };

      const dom = render(<PageHeader model={nav as any} />);

      const title = await dom.findByTestId('page-title');
      expect(title.textContent).toBe('node');
    });
  });

  describe('when the nav tree has a node with breadcrumbs and a title', () => {
    it('should render the title with breadcrumbs first and then title last', async () => {
      const nav = {
        main: {
          icon: 'folder-open',
          id: 'child',
          subTitle: 'child subtitle',
          url: '',
          text: 'child',
          breadcrumbs: [{ title: 'Parent', url: 'parentUrl' }],
        },
        node: {},
      };

      const dom = render(<PageHeader model={nav as any} />);

      const title = await dom.findByTestId('page-title');
      expect(title.textContent).toBe('Parent / child');

      const parentLink = await dom.findByTestId('breadcrumb-text-link');
      expect(parentLink.getAttribute('href')).toBe('parentUrl');
    });
  });
});
