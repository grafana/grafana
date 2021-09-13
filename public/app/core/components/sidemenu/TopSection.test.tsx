import React from 'react';
import { render, screen } from '@testing-library/react';
import TopSection from './TopSection';

jest.mock('../../config', () => ({
  bootData: {
    navTree: [
      { id: '1', hideFromMenu: true },
      { id: '2', hideFromMenu: true },
      { id: '3', hideFromMenu: false },
      { id: '4', hideFromMenu: true },
      { id: '4', hideFromMenu: false },
    ],
  },
}));

describe('Render', () => {
  it('should render search when empty', () => {
    render(<TopSection />);

    expect(screen.getByText('Search dashboards')).toBeInTheDocument();
  });

  it('should render items and search item', () => {
    render(<TopSection />);

    expect(screen.getByTestId('top-section-items').children.length).toBe(3);
  });
});
