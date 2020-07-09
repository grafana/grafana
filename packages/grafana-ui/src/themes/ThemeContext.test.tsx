import { config } from '@grafana/runtime';
import { renderHook } from '@testing-library/react-hooks';
import { css } from 'emotion';
import { mount } from 'enzyme';
import React from 'react';
import { useStyles } from './ThemeContext';

describe('useStyles', () => {
  it('memoizes the passed in function', () => {
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
