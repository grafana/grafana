import { render, screen } from '@testing-library/react';

import { StyledButton } from './StyledButton';

describe('StyledButton', () => {
  it('renders a button, or an anchor when href is passed', () => {
    render(
      <>
        <StyledButton>Save</StyledButton>
        <StyledButton href="/docs">Docs</StyledButton>
      </>
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
  });

  it('makes a disabled anchor ignore pointer events', () => {
    render(
      <>
        <StyledButton href="/docs" disabled>
          Disabled link
        </StyledButton>
        <StyledButton href="/docs">Enabled link</StyledButton>
      </>
    );
    expect(screen.getByRole('link', { name: 'Disabled link' })).toHaveStyle({ pointerEvents: 'none' });
    expect(screen.getByRole('link', { name: 'Enabled link' })).not.toHaveStyle({ pointerEvents: 'none' });
  });

  it('applies a different class for each variant and fill', () => {
    render(
      <>
        <StyledButton variant="primary">Primary</StyledButton>
        <StyledButton variant="destructive">Destructive</StyledButton>
        <StyledButton variant="primary" fill="outline">
          Outline
        </StyledButton>
      </>
    );
    const classNames = ['Primary', 'Destructive', 'Outline'].map(
      (name) => screen.getByRole('button', { name }).className
    );
    expect(new Set(classNames).size).toBe(3);
  });

  it('appends a className it is given', () => {
    render(<StyledButton className="custom">Save</StyledButton>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('custom');
  });
});
