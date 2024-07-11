import { render, screen } from '@testing-library/react';

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
    jest.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          matches: true,
        }) as unknown as MediaQueryList
    );

    const component = renderComponent();

    expect(component.queryByTestId('wrapper')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test item/i })).toBeInTheDocument();
  });

  it('should not use a wrapper on mobile screen', () => {
    jest.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          matches: false,
        }) as unknown as MediaQueryList
    );

    const component = renderComponent();

    expect(component.queryByTestId('wrapper')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test item/i })).toBeInTheDocument();
  });
});
