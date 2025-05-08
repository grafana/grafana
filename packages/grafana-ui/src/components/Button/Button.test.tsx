import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from './Button';

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

describe('Button', () => {
  it('should fire onClick when not disabled', async () => {
    const onClick = jest.fn();
    const { user } = setup(<Button onClick={onClick}>Click me</Button>);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not fire onClick when disabled', async () => {
    const onClick = jest.fn();
    const { user } = setup(
      <Button disabled onClick={onClick}>
        Click me
      </Button>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('should display icon when icon prop is provided', () => {
    setup(<Button icon="cloud">Click me</Button>);

    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });
});
