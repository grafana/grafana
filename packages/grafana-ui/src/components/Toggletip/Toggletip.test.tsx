import { render, screen, waitFor } from '@testing-library/react';
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
    render(
      <Toggletip placement="auto" content="Tooltip text">
        <Button type="button" data-testid="myButton">
          Click me!
        </Button>
      </Toggletip>
    );
    const button = screen.getByTestId('myButton');
    button.click();

    await waitFor(() => expect(screen.getByTestId('toggletip-content')).toBeInTheDocument());
    screen.getByTestId('toggletip-header-close').click();

    setTimeout(() => {
      expect(screen.getByTestId('toggletip-content')).not.toBeInTheDocument();
    });
  });
});
