import React from 'react';
import PageHeader from './PageHeader';
import { render, screen } from '@testing-library/react';

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

      render(<PageHeader model={nav as any} />);

      expect(screen.getByRole('heading', { name: 'node' })).toBeInTheDocument();
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

      render(<PageHeader model={nav as any} />);

      expect(screen.getByRole('heading', { name: 'Parent / child' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Parent' })).toBeInTheDocument();
    });
  });
});
