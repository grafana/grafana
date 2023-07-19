import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Button } from '../Button';

import { Toggletip } from './Toggletip';

describe('Toggletip', () => {
  it('should display toggletip after click on "Click me!" button', async () => {
    render(
      <Toggletip placement="auto" content="Tooltip text">
        <Button type="button" data-testid="myButton">
          Click me!
        </Button>
      </Toggletip>
    );
    expect(screen.getByText('Click me!')).toBeInTheDocument();
    const button = screen.getByTestId('myButton');
    await userEvent.click(button);

    expect(screen.getByTestId('toggletip-content')).toBeInTheDocument();
  });

  it('should close toggletip after click on close button', async () => {
    const closeSpy = jest.fn();
    render(
      <Toggletip placement="auto" content="Tooltip text" onClose={closeSpy}>
        <Button type="button" data-testid="myButton">
          Click me!
        </Button>
      </Toggletip>
    );
    const button = screen.getByTestId('myButton');
    await userEvent.click(button);

    expect(screen.getByTestId('toggletip-content')).toBeInTheDocument();

    const closeButton = screen.getByTestId('toggletip-header-close');
    expect(closeButton).toBeInTheDocument();
    await userEvent.click(closeButton);

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('should close toggletip after press ESC', async () => {
    const closeSpy = jest.fn();
    render(
      <Toggletip placement="auto" content="Tooltip text" onClose={closeSpy}>
        <Button type="button" data-testid="myButton">
          Click me!
        </Button>
      </Toggletip>
    );
    const button = screen.getByTestId('myButton');
    await userEvent.click(button);

    expect(screen.getByTestId('toggletip-content')).toBeInTheDocument();

    await userEvent.keyboard('{escape}');

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('should display the toggletip after press ENTER', async () => {
    const closeSpy = jest.fn();
    render(
      <Toggletip placement="auto" content="Tooltip text" onClose={closeSpy}>
        <Button type="button" data-testid="myButton">
          Click me!
        </Button>
      </Toggletip>
    );

    expect(screen.queryByTestId('toggletip-content')).not.toBeInTheDocument();

    // open toggletip with enter
    const button = screen.getByTestId('myButton');
    button.focus();
    await userEvent.keyboard('{enter}');

    expect(screen.getByTestId('toggletip-content')).toBeInTheDocument();
  });

  it('should be able to focus toggletip content next in DOM order - forwards and backwards', async () => {
    const closeSpy = jest.fn();
    const afterInDom = `Red herring button`;

    render(
      <>
        <Toggletip placement="auto" content="Tooltip text" onClose={closeSpy}>
          <Button type="button" data-testid="myButton">
            Click me!
          </Button>
        </Toggletip>
        <button>{afterInDom}</button>
      </>
    );

    expect(screen.queryByTestId('toggletip-content')).not.toBeInTheDocument();

    const button = screen.getByTestId('myButton');
    const afterButton = screen.getByText(afterInDom);
    await userEvent.click(button);
    await userEvent.tab();
    const closeButton = screen.getByTestId('toggletip-header-close');
    expect(closeButton).toHaveFocus();

    // focus after
    await userEvent.tab();
    expect(afterButton).toHaveFocus();

    // focus backwards
    await userEvent.tab({ shift: true });
    expect(closeButton).toHaveFocus();
  });
});
