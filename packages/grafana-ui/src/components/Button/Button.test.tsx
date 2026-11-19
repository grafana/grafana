import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';

import { createTheme, getThemeById } from '@grafana/data';

import { Button } from './Button';
import { getPropertiesForVariant } from './StyledButton.styles';

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

describe('Button', () => {
  it('stays a button when it is given an href', () => {
    const untypedProps: Record<string, unknown> = { href: undefined };
    render(<Button {...untypedProps}>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should fire onClick when not disabled', async () => {
    const onClick = jest.fn();
    const { user } = setup(<Button onClick={onClick}>Click me</Button>);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not fire onClick when disabled', async () => {
    const onClick = jest.fn();
    const { user } = setup(
      <Button disabled onClick={onClick}>
        Click me
      </Button>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('should display icon when icon prop is provided', () => {
    setup(<Button icon="cloud">Click me</Button>);

    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });

  it('should set an aria-label if there is a tooltip string but no children', () => {
    setup(<Button tooltip="Tooltip text" />);
    expect(screen.getByRole('button', { name: 'Tooltip text' })).toBeInTheDocument();
  });

  it('should not set an aria-label if there is a tooltip string but child text', () => {
    setup(<Button tooltip="Tooltip text">Child text</Button>);
    expect(screen.queryByRole('button', { name: 'Tooltip text' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Child text' })).toBeInTheDocument();
  });

  it('should prioritise the aria-label if it is present', () => {
    setup(
      <Button aria-label="Aria label" tooltip="Tooltip text">
        Child text
      </Button>
    );
    expect(screen.queryByRole('button', { name: 'Child text' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tooltip text' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aria label' })).toBeInTheDocument();
  });
});

describe('getPropertiesForVariant', () => {
  const theme = createTheme();

  it.each([
    ['warning', theme.colors.warning],
    ['info', theme.colors.info],
  ] as const)('uses the %s theme color for the %s variant', (variant, color) => {
    expect(getPropertiesForVariant(theme, variant, 'solid')).toMatchObject({
      background: color.main,
      color: color.contrastText,
    });
    expect(getPropertiesForVariant(theme, variant, 'outline')).toMatchObject({
      color: color.text,
      border: `1px solid ${color.border}`,
    });
    expect(getPropertiesForVariant(theme, variant, 'text')).toMatchObject({ color: color.text });
  });
});

describe('warning variant in the visual refresh themes', () => {
  describe.each(['visual_refresh_dark', 'visual_refresh_light'])('%s', (id) => {
    const refreshTheme = getThemeById(id);
    refreshTheme.flags.visualDesignRefresh = true;
    const { warning } = refreshTheme.colors;

    it('uses a brighter solid background than the standard step, with text that contrasts with it', () => {
      const styles = getPropertiesForVariant(refreshTheme, 'warning', 'solid');
      expect(styles.background).toBe(warning.borderEmphasis);
      expect(styles.background).not.toBe(warning.background);
      expect(styles.color).toBe(refreshTheme.colors.getContrastText(warning.borderEmphasis));
    });

    it('leaves the outline and text fills on the standard warning colors', () => {
      expect(getPropertiesForVariant(refreshTheme, 'warning', 'outline')).toMatchObject({ color: warning.text });
      expect(getPropertiesForVariant(refreshTheme, 'warning', 'text')).toMatchObject({ color: warning.text });
    });
  });
});
