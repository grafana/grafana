import { colorManipulator } from '@grafana/data';

import { getSelectableThemes } from './getSelectableThemes';

describe('Catppuccin themes', () => {
  it('keeps Latte primary and success button hover/focus colors readable', () => {
    const theme = getSelectableThemes()
      .find((entry) => entry.id === 'catppuccin_latte')!
      .build();
    const { primary, success } = theme.colors;
    expect(primary.mainEmphasis).toBe('#7a33d7');
    expect(success.shade).toBe('#53a940');
    for (const [text, background] of [
      [primary.contrastText, primary.mainEmphasis],
      [primary.contrastText, primary.shade],
      [success.contrastText, success.shade],
    ]) {
      expect(colorManipulator.getContrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ['catppuccin_frappe', 'rgba(198, 208, 245, 0.1)'],
    ['catppuccin_macchiato', 'rgba(202, 211, 245, 0.1)'],
    ['catppuccin_mocha', 'rgba(205, 214, 244, 0.1)'],
  ])('uses a translucent text-color hover overlay in %s', (id, hover) => {
    const theme = getSelectableThemes()
      .find((entry) => entry.id === id)!
      .build();
    expect(theme.colors.action.hover).toBe(hover);
  });

  it.each([
    ['catppuccin_mocha', '#45475a', '#585b70'],
    ['catppuccin_macchiato', '#494d64', '#5b6078'],
  ])('uses subtle control borders in %s', (id, border, strongBorder) => {
    const theme = getSelectableThemes()
      .find((entry) => entry.id === id)!
      .build();
    expect(theme.components.input.borderColor).toBe(border);
    expect(theme.components.input.borderHover).toBe(strongBorder);
    expect(theme.colors.secondary.border).toBe(border);
    expect(theme.colors.border.strong).toBe(strongBorder);
  });

  it.each([
    ['catppuccin_latte', '#179299'],
    ['catppuccin_frappe', '#81c8be'],
    ['catppuccin_macchiato', '#8bd5ca'],
    ['catppuccin_mocha', '#94e2d5'],
  ])('uses Catppuccin teal for the semi-dark-green visualization color in %s', (id, teal) => {
    const theme = getSelectableThemes()
      .find((entry) => entry.id === id)!
      .build();
    expect(theme.visualization.getColorByName('semi-dark-green')).toBe(teal);
  });

  it.each([
    ['catppuccin_latte', 'Catppuccin Latte', 'light', '#eff1f5', '#8839ef'],
    ['catppuccin_frappe', 'Catppuccin Frappé', 'dark', '#303446', '#ca9ee6'],
    ['catppuccin_macchiato', 'Catppuccin Macchiato', 'dark', '#24273a', '#c6a0f6'],
    ['catppuccin_mocha', 'Catppuccin Mocha', 'dark', '#1e1e2e', '#cba6f7'],
  ])('offers %s with mauve highlights and buttons', (id, name, mode, background, accent) => {
    const entry = getSelectableThemes().find((theme) => theme.id === id);
    expect(entry?.name).toBe(name);
    const theme = entry!.build();
    expect(theme.colors.mode).toBe(mode);
    expect(theme.colors.background.primary).toBe(background);
    expect(theme.colors.primary.main).toBe(accent);
    expect(theme.colors.accent.main).toBe(accent);
    expect(theme.colors.text.link).toBe(accent);
    expect(theme.colors.action.selectedBorder).toBe(accent);
    expect(theme.colors.gradients.brandVertical).toBe(`linear-gradient(0deg, ${accent} 0%, ${accent} 100%)`);
    expect(theme.colors.gradients.brandHorizontal).toBe(`linear-gradient(90deg, ${accent} 0%, ${accent} 100%)`);
    expect(colorManipulator.getContrastRatio(theme.colors.text.primary, background)).toBeGreaterThanOrEqual(4.5);
    for (const color of ['primary', 'accent', 'info', 'error', 'success', 'warning', 'tertiary'] as const) {
      const { main, contrastText } = theme.colors[color];
      expect(colorManipulator.getContrastRatio(contrastText, main)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
