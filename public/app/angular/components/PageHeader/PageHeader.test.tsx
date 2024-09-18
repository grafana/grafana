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
});
