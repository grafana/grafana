import { render, screen } from '@testing-library/react';
import React from 'react';

import { Button, LinkButton } from './Button';

describe('Button', () => {
  it('spins the spinner when specified as an icon', () => {
    const { container } = render(<Button icon="spinner">Loading...</Button>);
    expect(container.querySelector('.fa-spin')).toBeInTheDocument();
  });
});

describe('LinkButton', () => {
  it('Renders link button without attributes for disabled state.', () => {
    const linkText = 'link-button';
    const href = 'https://grafana.com';

    render(<LinkButton href={href}>{linkText}</LinkButton>);

    const linkElem = screen.getByText(linkText).closest('a');

    expect(linkElem).toHaveAttribute('href', href);
    expect(linkElem).not.toHaveAttribute('role');
    expect(linkElem).not.toHaveAttribute('aria-disabled');
  });

  it('Applies a11y compliant settings for disabled state', () => {
    const linkText = 'disabled-link-button';
    render(
      <LinkButton href="https://grafana.com" disabled>
        {linkText}
      </LinkButton>
    );

    const linkElem = screen.getByText(linkText).closest('a');

    expect(linkElem).not.toHaveAttribute('href');
    expect(linkElem).toHaveAttribute('role', 'link');
    expect(linkElem).toHaveAttribute('aria-disabled', 'true');
  });
});
