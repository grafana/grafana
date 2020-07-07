import React from 'react';
import { config } from '@grafana/runtime';
import { css } from 'emotion';
import { mount } from 'enzyme';
import { useStyles } from './ThemeContext';

describe('useStyles', () => {
  it('passes in theme and returns style object', () => {
    const Dummy: React.FC = function() {
      const styles = useStyles(theme => {
        expect(theme).toEqual(config.theme);

        return {
          someStyle: css`
            color: ${theme?.palette.critical};
          `,
        };
      });

      expect(typeof styles.someStyle).toBe('string');

      return <div>dummy</div>;
    };

    mount(<Dummy />);
  });
});
