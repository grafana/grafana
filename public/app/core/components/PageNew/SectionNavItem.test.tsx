import { render, screen } from '@testing-library/react';
import React from 'react';

import { NavModelItem } from '@grafana/data';

import { SectionNavItem } from './SectionNavItem';

describe('SectionNavItem', () => {
  it('should only show the img for a section root if both img and icon are present', () => {
    const item: NavModelItem = {
      text: 'Test',
      icon: 'k6',
      img: 'img',
      children: [
        {
          text: 'Child',
        },
      ],
    };

    render(<SectionNavItem item={item} isSectionRoot />);
    expect(screen.getByTestId('section-image')).toBeInTheDocument();
    expect(screen.queryByTestId('section-icon')).not.toBeInTheDocument();
  });
});
