import { act, render, screen } from '@testing-library/react';
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
    const afterInDom = 'Outside of toggletip';

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

    // focus back to togglebutton
    await userEvent.tab({ shift: true });
    expect(button).toHaveFocus();
  });

  describe('Focus state', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
      jest.useFakeTimers();
      // Need to use delay: null here to work with fakeTimers
      // see https://github.com/testing-library/user-event/issues/833
      user = userEvent.setup({ delay: null });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should restore focus to the button that opened the toggletip when closed from within the toggletip', async () => {
      const closeSpy = jest.fn();
      render(
        <Toggletip placement="auto" content="Tooltip text" onClose={closeSpy}>
          <Button type="button" data-testid="myButton">
            Click me!
          </Button>
        </Toggletip>
      );

      const button = screen.getByTestId('myButton');
      await user.click(button);
      const closeButton = await screen.findByTestId('toggletip-header-close');
      expect(closeButton).toBeInTheDocument();
      await user.click(closeButton);
      act(() => {
        jest.runAllTimers();
      });

      expect(button).toHaveFocus();
    });

    it('should NOT restore focus to the button that opened the toggletip when closed from outside the toggletip', async () => {
      const closeSpy = jest.fn();
      const afterInDom = 'Outside of toggletip';

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

      const button = screen.getByTestId('myButton');
      await user.click(button);
      const closeButton = await screen.findByTestId('toggletip-header-close');

      expect(closeButton).toBeInTheDocument();
      const afterButton = screen.getByText(afterInDom);
      afterButton.focus();

      await user.keyboard('{escape}');
      act(() => {
        jest.runAllTimers();
      });

      expect(afterButton).toHaveFocus();
    });
  });
});
