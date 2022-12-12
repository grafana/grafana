import { render, screen } from '@testing-library/react';
import React from 'react';

import { NavModelItem } from '@grafana/data';

import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  describe('when the nav tree has a node with a title', () => {
    it('should render the title', async () => {
      const nav: NavModelItem = {
        icon: 'folder-open',
        id: 'node',
        subTitle: 'node subtitle',
        url: '',
        text: 'node',
      };

      render(<PageHeader navItem={nav} />);

      expect(screen.getByRole('heading', { name: 'node' })).toBeInTheDocument();
    });
  });

  describe('when the nav tree has a node with breadcrumbs and a title', () => {
    it('should render the title with breadcrumbs first and then title last', async () => {
      const nav: NavModelItem = {
        icon: 'folder-open',
        id: 'child',
        subTitle: 'child subtitle',
        url: '',
        text: 'child',
        breadcrumbs: [{ title: 'Parent', url: 'parentUrl' }],
      };

      render(<PageHeader navItem={nav} />);

      expect(screen.getByRole('heading', { name: 'Parent / child' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Parent' })).toBeInTheDocument();
    });
  });
});
