import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type GrafanaTheme2, getThemeById } from '@grafana/data';
import { ThemeContext, getTagColorsFromName } from '@grafana/ui';

import { AlertLabel } from './AlertLabel';

describe('Label', () => {
  it('renders label and value with correct aria-label', () => {
    render(<AlertLabel labelKey="foo" value="bar" />);

    const item = screen.getByTestId('label-value');
    expect(item).toBeInTheDocument();
    expect(item).toHaveAttribute('aria-label', 'foo: bar');
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn();
    render(<AlertLabel labelKey="env" value="prod" onClick={onClick} />);

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(['prod', 'env']);
  });

  it('calls onClick when Enter is pressed', async () => {
    const onClick = jest.fn();
    render(<AlertLabel labelKey="region" value="eu-west-1" onClick={onClick} />);

    const button = screen.getByRole('button');
    await userEvent.type(button, '{enter}');
    expect(onClick).toHaveBeenCalledWith(['eu-west-1', 'region']);
  });
});

describe('Label colors', () => {
  // the refresh themes ship a tag palette where every background has a text color paired with it
  const refreshTheme = getThemeById('visual_refresh_dark');
  refreshTheme.flags.visualDesignRefresh = true;

  const classicTheme = getThemeById('visual_refresh_dark');

  const renderWithTheme = (theme: GrafanaTheme2) =>
    render(
      <ThemeContext.Provider value={theme}>
        <AlertLabel labelKey="env" value="prod" colorBy="key" />
      </ThemeContext.Provider>
    );

  it('uses the text color from the tag palette when the visual design refresh is enabled', () => {
    const { text } = getTagColorsFromName('env', refreshTheme);
    renderWithTheme(refreshTheme);

    expect(screen.getByText('prod')).toHaveStyle({ color: text });
  });

  it('derives a readable text color when the visual design refresh is disabled', () => {
    renderWithTheme(classicTheme);

    // the palette backgrounds are dark, so white is the readable choice
    expect(screen.getByText('prod')).toHaveStyle({ color: '#fff' });
  });
});
