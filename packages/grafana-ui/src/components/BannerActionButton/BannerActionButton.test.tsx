import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, ThemeContext } from '@grafana/data';

import { BannerActionButton } from './BannerActionButton';

describe('BannerActionButton', () => {
  it('renders a button and calls onClick when clicked', async () => {
    const onClick = jest.fn();
    render(<BannerActionButton onClick={onClick}>Request increase</BannerActionButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Request increase' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const onClick = jest.fn();
    render(
      <BannerActionButton onClick={onClick} disabled>
        Request increase
      </BannerActionButton>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Request increase' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(['error', 'warning', 'info', 'success'] as const)(
    'uses the border and text colors of the %s severity when severity is set',
    (severity) => {
      const theme = createTheme();
      render(
        <ThemeContext.Provider value={theme}>
          <BannerActionButton severity={severity}>Request increase</BannerActionButton>
        </ThemeContext.Provider>
      );
      expect(screen.getByRole('button', { name: 'Request increase' })).toHaveStyle({
        background: 'transparent',
        border: `1px solid ${theme.colors[severity].border}`,
        color: theme.colors[severity].text,
      });
    }
  );

  it('uses customColor for the border and text when customColor is set', () => {
    render(<BannerActionButton customColor="rgb(80, 65, 125)">Request increase</BannerActionButton>);
    expect(screen.getByRole('button', { name: 'Request increase' })).toHaveStyle({
      background: 'transparent',
      border: '1px solid rgb(80, 65, 125)',
      color: 'rgb(80, 65, 125)',
    });
  });

  it('does not accept a severity and a customColor together', () => {
    render(
      // @ts-expect-error severity and customColor are mutually exclusive
      <BannerActionButton severity="info" customColor="rgb(80, 65, 125)">
        Request increase
      </BannerActionButton>
    );
    expect(screen.getByRole('button', { name: 'Request increase' })).toBeInTheDocument();
  });

  it('has a black border and black text in a light theme without a severity or customColor', () => {
    render(
      <ThemeContext.Provider value={createTheme({ colors: { mode: 'light' } })}>
        <BannerActionButton>Request increase</BannerActionButton>
      </ThemeContext.Provider>
    );
    expect(screen.getByRole('button', { name: 'Request increase' })).toHaveStyle({
      background: 'transparent',
      border: '1px solid #000000',
      color: '#000000',
    });
  });

  it('has a transparent background, a white border and white text in a dark theme without a severity or customColor', () => {
    render(<BannerActionButton>Request increase</BannerActionButton>);
    expect(screen.getByRole('button', { name: 'Request increase' })).toHaveStyle({
      background: 'transparent',
      border: '1px solid #ffffff',
      color: '#ffffff',
    });
  });
});
