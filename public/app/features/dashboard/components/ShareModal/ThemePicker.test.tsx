import { render, screen } from '@testing-library/react';

import { ThemePicker } from './ThemePicker';

describe('ThemePicker', () => {
  it('should have an accessible label on the radiogroup', () => {
    render(<ThemePicker selectedTheme="current" onChange={jest.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
  });
});
