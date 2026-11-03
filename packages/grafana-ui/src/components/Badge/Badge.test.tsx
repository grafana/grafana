import { render, screen } from '@testing-library/react';

import { Badge, type BadgeColor } from './Badge';

describe('Badge', () => {
  it('renders the text', () => {
    render(<Badge text="Alpha" color="blue" />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  describe('with an unknown color', () => {
    const originalEnvironment = process.env.NODE_ENV;
    let warn: jest.SpyInstance;

    beforeEach(() => {
      warn = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnvironment;
      warn.mockRestore();
    });

    it('throws in development', () => {
      process.env.NODE_ENV = 'development';

      expect(() => render(<Badge text="Alpha" color={'not-a-color' as BadgeColor} />)).toThrow(
        `Badge: unknown color 'not-a-color', falling back to 'darkgrey'`
      );
    });

    it('warns and still renders in production', () => {
      process.env.NODE_ENV = 'production';

      render(<Badge text="Alpha" color={'not-a-color' as BadgeColor} />);

      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(warn).toHaveBeenCalledWith(`Badge: unknown color 'not-a-color', falling back to 'darkgrey'`);
    });
  });
});
