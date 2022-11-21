import { render, screen } from '@testing-library/react';
import React from 'react';

import { TopSearchBarSection, TopSearchBarSectionProps } from './TopSearchBarSection';

const renderComponent = (options?: { props: TopSearchBarSectionProps }) => {
  const { props } = options || {};
  return render(
    <TopSearchBarSection {...props}>
      <button>Test Item</button>
    </TopSearchBarSection>
  );
};

describe('TopSearchBarSection', () => {
  it('should use a wrapper on non mobile screen', () => {
    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      matches: () => false,
    }));

    const { container } = renderComponent();

    expect(container.querySelector('[data-test-id="wrapper"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test item/i })).toBeInTheDocument();
  });

  it('should not use a wrapper on mobile screen', () => {
    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      matches: () => true,
    }));

    const { container } = renderComponent();

    expect(container.querySelector('[data-test-id="wrapper"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test item/i })).toBeInTheDocument();
  });
});
