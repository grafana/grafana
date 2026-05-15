import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';

import { createTheme, FieldColorModeId, type GrafanaTheme2, ThemeContext } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  DYNAMIC_PALETTE_KEY_PREFIX,
  DYNAMIC_PALETTES_INDEX_KEY,
  resetDynamicFieldColorModesForTests,
} from 'app/features/dynamic-palettes/dynamicPalettes';

import { FieldColorEditor } from './fieldColor';

const testRegistryItems = [
  {
    id: 'foo',
    name: 'Foo',
    description: 'This option will appear in the picker',
    getCalculator: () => 'red',
  },
  {
    id: 'bar',
    name: 'Bar',
    description: 'This option will also appear in the picker',
    getCalculator: () => 'green',
  },
  {
    id: 'baz',
    name: 'Baz',
    description: 'This option will not appear in the picker',
    getCalculator: () => 'blue',
    excludeFromPicker: true,
  },
  {
    id: 'empty',
    name: 'Empty',
    description: 'This option has no colors in the active theme',
    getCalculator: () => 'orange',
    getColors: () => [],
  },
  {
    id: 'theme-aware',
    name: 'Theme aware',
    description: 'This option appears only when colors are available for the active theme',
    getCalculator: () => 'purple',
    getColors: (theme: GrafanaTheme2) => (theme.colors.mode === 'dark' ? ['#ffffff'] : []),
  },
  {
    id: FieldColorModeId.PaletteColorblind,
    name: 'Colorblind safe',
    description: 'Colorblind-safe palette option',
    getCalculator: () => 'red',
  },
];

jest.mock('@grafana/data', () => {
  const actualData = jest.requireActual('@grafana/data');
  return {
    ...actualData,
    fieldColorModeRegistry: new actualData.Registry(() => testRegistryItems),
  };
});

const defaultEditorProps = {
  value: undefined,
  onChange: () => {},
  id: 'test',
  'data-testid': 'test',
  context: { data: [] },
  item: testRegistryItems[0],
};

function renderWithTheme(ui: ReactElement, mode: 'light' | 'dark' = 'light') {
  const theme = createTheme({ colors: { mode } });
  return render(<ThemeContext.Provider value={theme}>{ui}</ThemeContext.Provider>);
}

describe('fieldColor', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDynamicFieldColorModesForTests();
  });

  it('filters out registry options with excludeFromPicker=true', async () => {
    renderWithTheme(<FieldColorEditor {...defaultEditorProps} />);
    await userEvent.type(screen.getByRole('combobox'), '{arrowdown}');
    expect(screen.getByText(/^Foo/i)).toBeInTheDocument();
    expect(screen.getByText(/^Bar/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Baz/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Empty/i)).not.toBeInTheDocument();
  });

  describe('enableColorblindSafePanelOptions', () => {
    let previousEnableColorblindSafePanelOptions: boolean | undefined;

    beforeEach(() => {
      previousEnableColorblindSafePanelOptions = config.featureToggles.enableColorblindSafePanelOptions;
    });

    afterEach(() => {
      config.featureToggles.enableColorblindSafePanelOptions = previousEnableColorblindSafePanelOptions;
    });

    it('shows the colorblind palette option only when the feature flag is enabled', async () => {
      config.featureToggles.enableColorblindSafePanelOptions = true;
      renderWithTheme(<FieldColorEditor {...defaultEditorProps} />);
      await userEvent.type(screen.getByRole('combobox'), '{arrowdown}');
      expect(screen.getByText(/^Colorblind safe/i)).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    it('does not show the colorblind palette option when the feature flag is disabled', async () => {
      config.featureToggles.enableColorblindSafePanelOptions = false;
      renderWithTheme(<FieldColorEditor {...defaultEditorProps} />);
      await userEvent.type(screen.getByRole('combobox'), '{arrowdown}');
      expect(screen.queryByText(/^Colorblind safe/i)).not.toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });
  });

  it('updates theme-filtered options after theme changes without reloading palettes', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithTheme(<FieldColorEditor {...defaultEditorProps} />, 'light');

    await user.type(screen.getByRole('combobox'), '{arrowdown}');
    expect(screen.queryByText(/^Theme aware/i)).not.toBeInTheDocument();

    const darkTheme = createTheme({ colors: { mode: 'dark' } });
    rerender(
      <ThemeContext.Provider value={darkTheme}>
        <FieldColorEditor {...defaultEditorProps} />
      </ThemeContext.Provider>
    );

    await user.keyboard('{Escape}');
    await user.type(screen.getByRole('combobox'), '{arrowdown}');
    expect(screen.getByText(/^Theme aware/i)).toBeInTheDocument();
  });

  describe('dynamic palettes', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());
    it('shows a palette loaded asynchronously from local storage', async () => {
      const dynamicId = `sunset-${Date.now()}`;
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      localStorage.setItem(
        DYNAMIC_PALETTES_INDEX_KEY,
        JSON.stringify([{ id: dynamicId, name: 'Sunset', group: 'Custom' }])
      );
      localStorage.setItem(
        `${DYNAMIC_PALETTE_KEY_PREFIX}${dynamicId}`,
        JSON.stringify(['#FF6B6B', '#FFB36B', '#FFD56B'])
      );

      renderWithTheme(<FieldColorEditor {...defaultEditorProps} />, 'dark');
      await user.type(screen.getByRole('combobox'), '{arrowdown}');
      await act(async () => {
        jest.advanceTimersByTime(2000);
        await Promise.resolve();
      });
      await user.keyboard('{Escape}');
      await user.type(screen.getByRole('combobox'), '{arrowdown}');

      expect(screen.getByText(/^Sunset/i)).toBeInTheDocument();
    });
  });
});
