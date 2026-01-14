import { render, screen } from '@testing-library/react';

import { MenuItemPrefix } from './MenuItemPrefix';

describe('MenuItemPrefix', () => {
  it('renders nothing when prefix is not provided', () => {
    const { container } = render(<MenuItemPrefix />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders icon when prefix is an IconName string', () => {
    const { container } = render(<MenuItemPrefix prefix="history" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders custom element when prefix is a React element', () => {
    render(<MenuItemPrefix prefix={<span data-testid="custom-icon">Custom</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('wraps React element prefix in a div with aria-hidden', () => {
    render(<MenuItemPrefix prefix={<span data-testid="custom-icon">Custom</span>} />);
    const wrapper = screen.getByTestId('custom-icon').parentElement;
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing when prefix is an invalid value', () => {
    // @ts-expect-error - testing invalid input
    const { container } = render(<MenuItemPrefix prefix="not-a-valid-icon-name" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when prefix is null', () => {
    // @ts-expect-error - testing null input
    const { container } = render(<MenuItemPrefix prefix={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
