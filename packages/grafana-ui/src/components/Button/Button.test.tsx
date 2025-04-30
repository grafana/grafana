import { render, screen, fireEvent } from '@testing-library/react';

import { Button } from './Button';

describe('Button', () => {
  it('should fire onClick when not disabled', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not fire onClick when disabled', () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        Click me
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('should display icon when icon prop is provided', () => {
    render(<Button icon="cloud">Click me</Button>);

    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });
});
