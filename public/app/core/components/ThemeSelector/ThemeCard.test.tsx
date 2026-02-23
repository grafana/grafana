import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, ThemeRegistryItem } from '@grafana/data';

import { ThemeCard } from './ThemeCard';

describe('ThemeCard', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  const mockTheme: ThemeRegistryItem = {
    id: 'dark',
    name: 'Dark',
    build: createTheme,
  };

  it('should only call onSelect once when clicking the radio button dot', async () => {
    const onSelectMock = jest.fn();

    render(<ThemeCard themeOption={mockTheme} onSelect={onSelectMock} isSelected={false} />);

    // Find the radio button input element
    const radioButtonInput = screen.getByRole('radio');

    // Click the radio button
    await user.click(radioButtonInput);

    // Check that onSelect was called only once
    expect(onSelectMock).toHaveBeenCalledTimes(1);
  });
});
