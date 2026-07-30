import { render, screen, waitFor } from '@testing-library/react';

import { createTheme } from '@grafana/data';

import { mockThemeContext } from '../../themes/ThemeContext';

import { Icon } from './Icon';
import { iconLoaders } from './iconLoaders.gen';

describe('Icon with iconsRefresh enabled', () => {
  let restoreThemeContext: () => void;

  beforeEach(() => {
    restoreThemeContext = mockThemeContext({ ...createTheme(), flags: { iconsRefresh: true } });
  });

  afterEach(() => {
    restoreThemeContext();
  });

  // Guards the Yarn patch that adds @grafana/icons' `./*` subpath export, and the
  // jest moduleNameMapper that points those subpaths at the ESM leaf modules.
  // Without either, every loader rejects and icons silently render empty.
  it('resolves a leaf module through the per-icon subpath export', async () => {
    await expect(iconLoaders['heart']()).resolves.toBeInstanceOf(Function);
  });

  it('renders the resolved glyph rather than the empty placeholder', async () => {
    render(<Icon name="heart" />);

    await waitFor(() => {
      expect(screen.getByTestId('icon-heart').querySelector('path')).not.toBeNull();
    });
  });

  it('renders a correctly sized placeholder for a name with no mapping', () => {
    // Plugins can pass a name outside IconName; it must degrade, not throw.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // @ts-expect-error deliberately outside IconName — plugins can supply any string at runtime.
    render(<Icon name="definitely-not-an-icon" size="lg" />);

    const svg = screen.getByTestId('icon-definitely-not-an-icon');
    expect(svg.querySelector('path')).toBeNull();
    expect(svg).toHaveAttribute('width', '18');
    expect(warn).toHaveBeenCalledWith('Icon component passed an invalid icon name', 'definitely-not-an-icon');

    warn.mockRestore();
  });
});

describe('Icon with iconsRefresh disabled', () => {
  it('falls back to the legacy react-inlinesvg implementation', () => {
    render(<Icon name="heart" />);

    // The legacy path resolves an SVG URL; the new one has no src to resolve.
    expect(screen.getByTestId('icon-heart')).toHaveAttribute('id', expect.stringContaining('heart.svg'));
  });
});
