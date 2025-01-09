import { css, cx } from '@emotion/css';
import { components, ContainerProps as BaseContainerProps, GroupBase } from 'react-select';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
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

  const styles = useStyles2(getSelectContainerStyles, isFocused, isDisabled, invalid);

  return (
    <components.SelectContainer {...props} className={cx(styles.wrapper, props.className)}>
      {children}
    </components.SelectContainer>
  );
};

const getSelectContainerStyles = (theme: GrafanaTheme2, focused: boolean, disabled: boolean, invalid: boolean) => {
  const styles = getInputStyles({ theme, invalid });

  return {
    wrapper: cx(
      styles.wrapper,
      sharedInputStyle(theme, invalid),
      focused && css(getFocusStyles(theme)),
      disabled && styles.inputDisabled,
      css({
        position: 'relative',
        boxSizing: 'border-box',
        /* The display property is set by the styles prop in SelectBase because it's dependant on the width prop  */
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        minHeight: theme.spacing(theme.components.height.md),
        height: 'auto',
        maxWidth: '100%',

        /* Input padding is applied to the InputControl so the menu is aligned correctly */
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
      })
    ),
  };
};
