import { css, cx } from '@emotion/css';
import { forwardRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { inputPadding } from '../Forms/commonStyles';
import { getInputStyles } from '../Input/Input';

interface InputControlProps {
  /** Show an icon as a prefix in the input */
  prefix?: JSX.Element | string | null;
  focused: boolean;
  invalid: boolean;
  disabled: boolean;
  innerProps: JSX.IntrinsicElements['div'];
}

export const InputControl = forwardRef<HTMLDivElement, React.PropsWithChildren<InputControlProps>>(
  function InputControl({ focused, invalid, disabled, children, innerProps, prefix, ...otherProps }, ref) {
    const styles = useStyles2(getInputControlStyles, invalid, !!prefix);

    return (
      <div className={styles.input} {...innerProps} ref={ref}>
        {prefix && <div className={cx(styles.prefix)}>{prefix}</div>}
        {children}
      </div>
    );
  }
);

const getInputControlStyles = (theme: GrafanaTheme2, invalid: boolean, withPrefix: boolean) => {
  const styles = getInputStyles({ theme, invalid });

  return {
    input: cx(
      inputPadding(theme),
      css({
        width: '100%',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingRight: 0,
        position: 'relative',
        boxSizing: 'border-box',
      }),
      withPrefix &&
        css({
          paddingLeft: 0,
        })
    ),
    prefix: cx(
      styles.prefix,
      css({
        position: 'relative',
      })
    ),
  };
};
