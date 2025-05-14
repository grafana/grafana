import { css } from '@emotion/css';
import { render, renderHook } from '@testing-library/react';

import { createTheme, GrafanaTheme2 } from '@grafana/data';

import { mockThemeContext, useStyles2 } from './ThemeContext';

describe('useStyles', () => {
  it('memoizes the passed in function correctly', () => {
    // implementation has extra arguments to implicitly test the typescript definition of useStyles2
    const getStyles = jest.fn((theme: GrafanaTheme2, isOdd: boolean) => ({ row: 'row-class-name' }));

    function Row({ isOdd }: { isOdd: boolean }) {
      const styles = useStyles2(getStyles, isOdd);
      return <div className={styles.row} />;
    }

    function TestUseStyles() {
      return (
        <>
          <Row isOdd={true} />
          <Row isOdd={false} />
          <Row isOdd={true} />
          <Row isOdd={false} />
          <Row isOdd={true} />
          <Row isOdd={false} />
        </>
      );
    }

    render(<TestUseStyles />);

    expect(getStyles).toHaveBeenCalledTimes(2);
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

    const restoreThemeContext = mockThemeContext(createTheme());
    rerender();
    expect(storedReference).not.toBe(result.current);
    restoreThemeContext();
  });

  it('passes in theme and returns style object', (done) => {
    const Dummy = function () {
      const styles = useStyles2((theme) => {
        return {
          someStyle: css({
            color: theme.colors.success.main,
          }),
        };
      });

      expect(typeof styles.someStyle).toBe('string');
      done();

      return <div>dummy</div>;
    };

    render(<Dummy />);
  });
});
