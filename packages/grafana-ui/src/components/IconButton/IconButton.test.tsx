import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';

import { IconButton } from './IconButton';

describe('IconButton', () => {
  const theme = createTheme();

  it.each([
    ['secondary', theme.colors.secondary.text],
    ['destructive', theme.colors.error.text],
    ['warning', theme.colors.warning.text],
  ] as const)('colors the %s variant icon with its theme text color', (variant, expectedColor) => {
    render(<IconButton name="exclamation-triangle" variant={variant} aria-label="Status" />);

    expect(screen.getByRole('button', { name: 'Status' })).toHaveStyle({ color: expectedColor });
  });

  it('gives the warning variant an accessible name from its tooltip', () => {
    render(<IconButton name="exclamation-triangle" variant="warning" tooltip="2 alerts firing" />);

    expect(screen.getByRole('button', { name: '2 alerts firing' })).toBeInTheDocument();
  });

  it('does not call onClick for a disabled warning variant', async () => {
    const onClick = jest.fn();
    render(<IconButton name="exclamation-triangle" variant="warning" aria-label="Alerts" disabled onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Alerts' }));

    expect(screen.getByRole('button', { name: 'Alerts' })).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });
});
