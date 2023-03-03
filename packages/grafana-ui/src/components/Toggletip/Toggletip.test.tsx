import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Button } from '../Button';

import { Toggletip } from './Toggletip';

describe('Toggletip', () => {
  it('should display toogletip after click on "Click me!" button', async () => {
    render(
      <Toggletip placement="auto" content="Tooltip text">
        <Button type="button" data-testid="myButton">
          Click me!
        </Button>
      </Toggletip>
    );
    expect(screen.getByText('Click me!')).toBeInTheDocument();
    const button = screen.getByTestId('myButton');
    button.click();

    await waitFor(() => expect(screen.getByTestId('toggletip-content')).toBeInTheDocument());
  });

  it('should close toogletip after click on close button', async () => {
    const closeSpy = jest.fn();
    render(
      <Toggletip placement="auto" content="Tooltip text" onClose={closeSpy}>
        <Button type="button" data-testid="myButton">
          Click me!
        </Button>
      </Toggletip>
    );
    const button = screen.getByTestId('myButton');
    button.click();

    await waitFor(() => expect(screen.getByTestId('toggletip-content')).toBeInTheDocument());

    const closeButton = screen.getByTestId('toggletip-header-close');
    expect(closeButton).toBeInTheDocument();
    closeButton.click();

    await waitFor(() => {
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('should close toogletip after press ESC', async () => {
    const closeSpy = jest.fn();
    render(
      <Toggletip placement="auto" content="Tooltip text" onClose={closeSpy}>
        <Button type="button" data-testid="myButton">
          Click me!
        </Button>
      </Toggletip>
    );
    const button = screen.getByTestId('myButton');
    button.click();

    await waitFor(() => expect(screen.getByTestId('toggletip-content')).toBeInTheDocument());

    fireEvent.keyDown(global.document, {
      code: 'Escape',
      key: 'Escape',
      keyCode: 27,
    });

    await waitFor(() => expect(closeSpy).toHaveBeenCalledTimes(1));
  });

  it('should display the toogletip after press ENTER', async () => {
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
    userEvent.keyboard('{enter}');

    await waitFor(() => expect(screen.getByTestId('toggletip-content')).toBeInTheDocument());
  });
});
