import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button, LinkButton } from './Button';

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

describe('LinkButton', () => {
  it('should place the icon on the right when iconPlacement is "right"', () => {
    setup(
      <LinkButton icon="cloud" iconPlacement="right" href="https://grafana.com">
        Click me
      </LinkButton>
    );

    const link = screen.getByRole('link');
    const icon = screen.getByTitle('');
    const textSpan = link.querySelector('span');

    // Assert that the text span comes before the icon in the DOM
    expect(link.childNodes[0]).toBe(textSpan);
    expect(link.childNodes[1]).toBe(icon);
  });

  it('should place the icon on the left when iconPlacement is "left"', () => {
    setup(
      <LinkButton icon="cloud" iconPlacement="left" href="https://grafana.com">
        Click me
      </LinkButton>
    );

    const link = screen.getByRole('link');
    const icon = screen.getByTitle('');
    const textSpan = link.querySelector('span');

    // Assert that the icon comes before the text span in the DOM
    expect(link.childNodes[0]).toBe(icon);
    expect(link.childNodes[1]).toBe(textSpan);
  });
});
