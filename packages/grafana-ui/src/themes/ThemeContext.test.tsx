import { css } from '@emotion/css';
import { render, renderHook } from '@testing-library/react';
import React from 'react';

import { mockThemeContext, useStyles2 } from './ThemeContext';

describe('useStyles', () => {
  it('memoizes the passed in function correctly', () => {
    const stylesCreator = () => ({});
    const { rerender, result } = renderHook(() => useStyles2(stylesCreator));
    const storedReference = result.current;

    rerender();
    expect(storedReference).toBe(result.current);
  });

  it('does not memoize if the passed in function changes every time', () => {
    const { rerender, result } = renderHook(() => useStyles2(() => ({})));
    const storedReference = result.current;
    rerender();
    expect(storedReference).not.toBe(result.current);
  });

  it('updates the memoized function when the theme changes', () => {
    const stylesCreator = () => ({});
    const { rerender, result } = renderHook(() => useStyles2(stylesCreator));
    const storedReference = result.current;

    const restoreThemeContext = mockThemeContext({});
    rerender();
    expect(storedReference).not.toBe(result.current);
    restoreThemeContext();
  });

  it('passes in theme and returns style object', (done) => {
    const Dummy = function () {
      const styles = useStyles2((theme) => {
        return {
          someStyle: css`
            color: ${theme.colors.success.main};
          `,
        };
      });

      expect(typeof styles.someStyle).toBe('string');
      done();

      return <div>dummy</div>;
    };

    render(<Dummy />);
  });
});
