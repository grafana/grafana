import React from 'react';
import { useTheme2 } from '../../themes/ThemeContext';
import { sharedInputStyle } from '../Forms/commonStyles';
import { getInputStyles } from '../Input/Input';
import { css, cx } from '@emotion/css';
import { stylesFactory } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';
import { focusCss } from '../../themes/mixins';
import { components, ContainerProps as BaseContainerProps, GroupBase } from 'react-select';

// isFocus prop is actually available, but its not in the types for the version we have.
export interface ContainerProps<Option, isMulti extends boolean, Group extends GroupBase<Option>>
  extends BaseContainerProps<Option, isMulti, Group> {
  isFocused: boolean;
}

export const SelectContainer = <Option, isMulti extends boolean, Group extends GroupBase<Option>>(
  props: ContainerProps<Option, isMulti, Group>
) => {
  const { isDisabled, isFocused, children } = props;

  const theme = useTheme2();
  const styles = getSelectContainerStyles(theme, isFocused, isDisabled);

  return (
    <components.SelectContainer {...props} className={cx(styles.wrapper, props.className)}>
      {children}
    </components.SelectContainer>
  );
};

const getSelectContainerStyles = stylesFactory((theme: GrafanaTheme2, focused: boolean, disabled: boolean) => {
  const styles = getInputStyles({ theme, invalid: false });

  return {
    wrapper: cx(
      styles.wrapper,
      sharedInputStyle(theme, false),
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
        align-items: center;
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
});
