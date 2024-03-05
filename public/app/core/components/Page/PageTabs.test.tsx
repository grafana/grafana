import { render, screen } from '@testing-library/react';
import React from 'react';

import { NavModelItem } from '@grafana/data';

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
});
