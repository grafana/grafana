import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';

import { GradientButton } from './GradientButton';
import { getGradientButtonFillStyles } from './GradientButton.styles';

describe('GradientButton', () => {
  it('calls onClick, and ignores clicks when disabled', async () => {
    const onClick = jest.fn();
    render(
      <>
        <GradientButton onClick={onClick}>Analyze</GradientButton>
        <GradientButton onClick={onClick} disabled>
          Disabled
        </GradientButton>
      </>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    await userEvent.click(screen.getByRole('button', { name: 'Disabled' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows the ai-sparkle icon by default, and lets icon override it', () => {
    render(
      <>
        <GradientButton>Analyze</GradientButton>
        <GradientButton icon="spinner">Analyzing</GradientButton>
      </>
    );
    expect(within(screen.getByRole('button', { name: 'Analyze' })).getByTestId('icon-ai-sparkle')).toBeInTheDocument();
    const loading = screen.getByRole('button', { name: 'Analyzing' });
    expect(within(loading).getByTestId('icon-spinner')).toBeInTheDocument();
    expect(within(loading).queryByTestId('icon-ai-sparkle')).not.toBeInTheDocument();
  });

  it('shows the ai-sparkle icon with no children, and requires a tooltip or aria-label as the accessible name', () => {
    // @ts-expect-error an icon-only button needs a tooltip or an aria-label
    void (<GradientButton />);

    render(
      <>
        <GradientButton tooltip="Analyze with Assistant" />
        <GradientButton aria-label="Open Assistant" />
      </>
    );
    expect(
      within(screen.getByRole('button', { name: 'Analyze with Assistant' })).getByTestId('icon-ai-sparkle')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('button', { name: 'Open Assistant' })).getByTestId('icon-ai-sparkle')
    ).toBeInTheDocument();
  });

  it.each([
    { fill: 'outline' as const, tooltip: undefined },
    { fill: 'solid' as const, tooltip: undefined },
    { fill: 'outline' as const, tooltip: 'Assistant is unavailable' },
    { fill: 'solid' as const, tooltip: 'Assistant is unavailable' },
  ])(
    'replaces the gradient with the disabled background when disabled (fill $fill, tooltip $tooltip)',
    ({ fill, tooltip }) => {
      const theme = createTheme();
      render(
        <GradientButton fill={fill} tooltip={tooltip} disabled>
          Analyze with Assistant
        </GradientButton>
      );
      expect(screen.getByRole('button', { name: 'Analyze with Assistant' })).toHaveStyle({
        background: theme.colors.action.disabledBackground,
        border: '1px solid transparent',
      });
    }
  );

  it('keeps the disabled background when an aria-disabled button with a tooltip is pressed', () => {
    const theme = createTheme();
    render(
      <GradientButton fill="solid" tooltip="Assistant is unavailable" disabled>
        Analyze with Assistant
      </GradientButton>
    );
    const button = screen.getByRole('button', { name: 'Analyze with Assistant' });
    const className = [...button.classList].find((name) => name.includes('gradient-button'));
    const activeRules = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText === `.${className}:active`
      );
    // The last :active rule wins, so it has to be the disabled one
    expect(activeRules.at(-1)?.style.background).toBe(theme.colors.action.disabledBackground);
  });
});

describe('getGradientButtonFillStyles', () => {
  const theme = createTheme();

  it('draws a 1px border from the button gradient token behind the secondary color with fill outline', () => {
    const styles = getGradientButtonFillStyles(theme, 'outline');
    expect(styles.border).toBe('1px solid transparent');
    expect(styles.background).toContain(`${theme.colors.gradients.button} border-box`);
    expect(styles.background).toContain(
      `linear-gradient(${theme.colors.secondary.main}, ${theme.colors.secondary.main}) padding-box`
    );
  });

  it('uses the secondary hover color behind the gradient when hovered or expanded', () => {
    const styles = getGradientButtonFillStyles(theme, 'outline');
    const { shade } = theme.colors.secondary;
    const hoverBackground = expect.stringContaining(`linear-gradient(${shade}, ${shade}) padding-box`);
    expect(styles).toHaveProperty(['&:hover', 'background'], hoverBackground);
    expect(styles).toHaveProperty(['&[aria-expanded="true"]', 'background'], hoverBackground);
    expect(styles.background).not.toContain(shade);
  });

  it('uses the secondary emphasis background on hover when the visual refresh is enabled', () => {
    const refreshTheme = { ...theme, flags: { ...theme.flags, visualDesignRefresh: true } };
    const { backgroundEmphasis } = refreshTheme.colors.secondary;
    expect(getGradientButtonFillStyles(refreshTheme, 'outline')).toHaveProperty(
      ['&:hover', 'background'],
      expect.stringContaining(`linear-gradient(${backgroundEmphasis}, ${backgroundEmphasis}) padding-box`)
    );
  });

  it('fills the button with the gradient and uses the canvas color for text in dark mode with fill solid', () => {
    const styles = getGradientButtonFillStyles(theme, 'solid');
    expect(styles.background).toBe(`${theme.colors.gradients.button} border-box`);
    expect(styles.color).toBe(theme.colors.background.canvas);
    expect(styles).toHaveProperty(['&:hover', 'background'], expect.stringContaining(theme.colors.action.hover));
  });

  it('uses black text on the gradient fill in light mode', () => {
    const lightTheme = createTheme({ colors: { mode: 'light' } });
    expect(getGradientButtonFillStyles(lightTheme, 'solid').color).toBe(lightTheme.colors.text.maxContrast);
  });

  it.each(['outline' as const, 'solid' as const])('has no !important or transition overrides (fill %s)', (fill) => {
    const serialized = JSON.stringify(getGradientButtonFillStyles(theme, fill));
    expect(serialized).not.toContain('!important');
    expect(serialized).not.toContain('transition');
  });
});
