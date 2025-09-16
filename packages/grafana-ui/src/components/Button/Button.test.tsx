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

  it('should set an aria-label if there is a tooltip string but no children', () => {
    setup(<Button tooltip="Tooltip text" />);
    expect(screen.getByRole('button', { name: 'Tooltip text' })).toBeInTheDocument();
  });

  it('should not set an aria-label if there is a tooltip string but child text', () => {
    setup(<Button tooltip="Tooltip text">Child text</Button>);
    expect(screen.queryByRole('button', { name: 'Tooltip text' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Child text' })).toBeInTheDocument();
  });

  it('should prioritise the aria-label if it is present', () => {
    setup(
      <Button aria-label="Aria label" tooltip="Tooltip text">
        Child text
      </Button>
    );
    expect(screen.queryByRole('button', { name: 'Child text' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tooltip text' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aria label' })).toBeInTheDocument();
  });
});
