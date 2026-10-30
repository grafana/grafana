import { render, screen } from '@testing-library/react';

import { type GrafanaTheme2, getThemeById } from '@grafana/data';
import { ThemeContext, getTagColorsFromName } from '@grafana/ui';

import { MatcherBadge } from './MatcherBadge';

describe('MatcherBadge', () => {
  it('renders the matcher as a single piece of text', () => {
    render(<MatcherBadge name="team" operator="=~" value="ops|sre" />);

    expect(screen.getByText('team =~ ops|sre')).toBeInTheDocument();
  });

  it('keeps an empty value visible as trailing whitespace', () => {
    render(<MatcherBadge name="team" operator="=" value="" data-testid="matcher" />);

    expect(screen.getByTestId('matcher')).toHaveTextContent('team = ', { normalizeWhitespace: false });
  });
});

describe('MatcherBadge colors', () => {
  const refreshTheme = getThemeById('visual_refresh_dark');
  refreshTheme.flags.visualDesignRefresh = true;

  const classicTheme = getThemeById('visual_refresh_dark');

  const renderWithTheme = (theme: GrafanaTheme2, color?: string) =>
    render(
      <ThemeContext.Provider value={theme}>
        <MatcherBadge name="env" operator="=" value="prod" color={color} />
      </ThemeContext.Provider>
    );

  it('uses the text color from the tag palette when the visual design refresh is enabled', () => {
    const { text } = getTagColorsFromName('env', refreshTheme);
    renderWithTheme(refreshTheme);

    expect(screen.getByText('env = prod')).toHaveStyle({ color: text });
  });

  it('derives a readable text color when the visual design refresh is disabled', () => {
    renderWithTheme(classicTheme);

    // the palette backgrounds are dark, so white is the readable choice
    expect(screen.getByText('env = prod')).toHaveStyle({ color: '#fff' });
  });

  it('picks the color from the color prop instead of the name when given', () => {
    const { background } = getTagColorsFromName('"env"', refreshTheme);
    renderWithTheme(refreshTheme, '"env"');

    expect(screen.getByText('env = prod')).toHaveStyle({ background });
  });
});
