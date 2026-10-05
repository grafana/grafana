import { renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import { createTheme, type GrafanaTheme2, type InterpolateFunction, ThemeContext } from '@grafana/data';

import { useThemedReplaceVariables } from './useThemedReplaceVariables';

describe('useThemedReplaceVariables', () => {
  const dark = createTheme({ colors: { mode: 'dark' } });
  const light = createTheme({ colors: { mode: 'light' } });

  function setup(replaceVariables: InterpolateFunction) {
    let theme = dark;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    );
    const hook = renderHook(() => useThemedReplaceVariables(replaceVariables), { wrapper });

    return {
      ...hook,
      switchTheme: (next: GrafanaTheme2) => {
        theme = next;
        hook.rerender();
      },
    };
  }

  it('passes calls through to replaceVariables unchanged', () => {
    const replaceVariables = jest.fn().mockReturnValue('out');
    const { result } = setup(replaceVariables);

    expect(result.current('${host}', { host: { value: 'a' } }, 'html')).toBe('out');
    expect(replaceVariables).toHaveBeenCalledWith('${host}', { host: { value: 'a' } }, 'html');
  });

  it('keeps the same function while the theme stays the same', () => {
    const { result, rerender } = setup(jest.fn());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('returns a new function when the theme changes', () => {
    const { result, switchTheme } = setup(jest.fn());
    const first = result.current;

    switchTheme(light);

    expect(result.current).not.toBe(first);
  });
});
