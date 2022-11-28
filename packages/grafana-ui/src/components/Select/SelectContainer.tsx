import { css, cx } from '@emotion/css';
import React from 'react';
import { components, ContainerProps as BaseContainerProps, GroupBase } from 'react-select';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory } from '../../themes';
import { useTheme2 } from '../../themes/ThemeContext';
import { focusCss } from '../../themes/mixins';
import { sharedInputStyle } from '../Forms/commonStyles';
import { getInputStyles } from '../Input/Input';

import { CustomComponentProps } from './types';

// prettier-ignore
export type SelectContainerProps<Option, isMulti extends boolean, Group extends GroupBase<Option>> =
  BaseContainerProps<Option, isMulti, Group> & CustomComponentProps<Option, isMulti, Group>;

export const SelectContainer = <Option, isMulti extends boolean, Group extends GroupBase<Option>>(
  props: SelectContainerProps<Option, isMulti, Group>
) => {
  const {
    isDisabled,
    isFocused,
    children,
    selectProps: { invalid = false },
  } = props;

  const theme = useTheme2();
  const styles = getSelectContainerStyles(theme, isFocused, isDisabled, invalid);

  return (
    <components.SelectContainer {...props} className={cx(styles.wrapper, props.className)}>
      {children}
    </components.SelectContainer>
  );
};

const getSelectContainerStyles = stylesFactory(
  (theme: GrafanaTheme2, focused: boolean, disabled: boolean, invalid: boolean) => {
    const styles = getInputStyles({ theme, invalid });

    return {
      wrapper: cx(
        styles.wrapper,
        sharedInputStyle(theme, invalid),
        focused &&
          css`
            ${focusCss(theme.v1)}
          `,
        disabled && styles.inputDisabled,
        css`
          position: relative;
          box-sizing: border-box;
          /* The display property is set by the styles prop in SelectBase because it's dependant on the width prop  */
          flex-direction: row;
          flex-wrap: wrap;
          align-items: stretch;
          justify-content: space-between;

          min-height: 32px;
          height: auto;
          max-width: 100%;

          /* Input padding is applied to the InputControl so the menu is aligned correctly */
          padding: 0;
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
        `
      ),
    };
  }
);
