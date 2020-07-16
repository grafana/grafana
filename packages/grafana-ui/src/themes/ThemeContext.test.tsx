import React from 'react';
import { config } from '@grafana/runtime';
import { renderHook } from '@testing-library/react-hooks';
import { css } from 'emotion';
import { mount } from 'enzyme';
import { memoizedStyleCreators, mockThemeContext, useStyles } from './ThemeContext';

describe('useStyles', () => {
  it('memoizes the passed in function correctly', () => {
    const stylesCreator = () => ({});
    const { rerender, result } = renderHook(() => useStyles(stylesCreator));
    const storedReference = result.current;

    rerender();
    expect(storedReference).toBe(result.current);
  });

  it('does not memoize if the passed in function changes every time', () => {
    const { rerender, result } = renderHook(() => useStyles(() => ({})));
    const storedReference = result.current;
    rerender();
    expect(storedReference).not.toBe(result.current);
  });

  it('updates the memoized function when the theme changes', () => {
    const stylesCreator = () => ({});
    const { rerender, result } = renderHook(() => useStyles(stylesCreator));
    const storedReference = result.current;

    const restoreThemeContext = mockThemeContext({});
    rerender();
    expect(storedReference).not.toBe(result.current);
    restoreThemeContext();
  });

  it('cleans up memoized functions whenever a new one comes along or the component unmounts', () => {
    const styleCreators: Function[] = [];
    const { rerender, unmount } = renderHook(() => {
      const styleCreator = () => ({});
      styleCreators.push(styleCreator);
      return useStyles(styleCreator);
    });

    expect(typeof memoizedStyleCreators.get(styleCreators[0])).toBe('function');
    rerender();
    expect(memoizedStyleCreators.get(styleCreators[0])).toBeUndefined();
    expect(typeof memoizedStyleCreators.get(styleCreators[1])).toBe('function');
    unmount();
    expect(memoizedStyleCreators.get(styleCreators[0])).toBeUndefined();
    expect(memoizedStyleCreators.get(styleCreators[1])).toBeUndefined();
  });

  it('passes in theme and returns style object', done => {
    const Dummy: React.FC = function() {
      const styles = useStyles(theme => {
        expect(theme).toEqual(config.theme);

        return {
          someStyle: css`
            color: ${theme.palette.critical};
          `,
        };
      });

      expect(typeof styles.someStyle).toBe('string');
      done();

      return <div>dummy</div>;
    };

    mount(<Dummy />);
  });
});
