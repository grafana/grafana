import { cx, css } from '@emotion/css';
import { cloneElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { getChildId } from '../../utils/reactUtils';
import { PopoverContent } from '../Tooltip';

import { FieldProps } from './Field';
import { FieldValidationMessage } from './FieldValidationMessage';
import { InlineLabel } from './InlineLabel';

export interface Props extends Omit<FieldProps, 'css' | 'horizontal' | 'description' | 'error'> {
  /** Content for the label's tooltip */
  tooltip?: PopoverContent;
  /** Custom width for the label as a multiple of 8px */
  labelWidth?: number | 'auto';
  /** Make the field's child to fill the width of the row. Equivalent to setting `flex-grow:1` on the field */
  grow?: boolean;
  /** Make the field's child shrink with width of the row. Equivalent to setting `flex-shrink:1` on the field */
  shrink?: boolean;
  /** Make field's background transparent */
  transparent?: boolean;
  /** Error message to display */
  error?: string | null;
  htmlFor?: string;
  /** Make tooltip interactive */
  interactive?: boolean;
}

export const InlineField = ({
  children,
  label,
  tooltip,
  labelWidth = 'auto',
  invalid,
  loading,
  disabled,
  required,
  className,
  htmlFor,
  grow,
  shrink,
  error,
  transparent,
  interactive,
  validationMessageHorizontalOverflow,
  ...htmlProps
}: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme, grow, shrink);
  const inputId = htmlFor ?? getChildId(children);

  const labelElement =
    typeof label === 'string' ? (
      <InlineLabel
        interactive={interactive}
        width={labelWidth}
        tooltip={tooltip}
        htmlFor={inputId}
        transparent={transparent}
      >
        {`${label}${required ? ' *' : ''}`}
      </InlineLabel>
    ) : (
      label
    );

  return (
    <div className={cx(styles.container, className)} {...htmlProps}>
      {labelElement}
      <div className={styles.childContainer}>
        {cloneElement(children, { invalid, disabled, loading })}
        {invalid && error && (
          <div
            className={cx(styles.fieldValidationWrapper, {
              [styles.validationMessageHorizontalOverflow]: !!validationMessageHorizontalOverflow,
            })}
          >
            <FieldValidationMessage>{error}</FieldValidationMessage>
          </div>
        )}
      </div>
    </div>
  );
};

InlineField.displayName = 'InlineField';

const getStyles = (theme: GrafanaTheme2, grow?: boolean, shrink?: boolean) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      textAlign: 'left',
      position: 'relative',
      flex: `${grow ? 1 : 0} ${shrink ? 1 : 0} auto`,
      margin: `0 ${theme.spacing(0.5)} ${theme.spacing(0.5)} 0`,
      maxWidth: '100%',
    }),
    childContainer: css({
      flex: `${grow ? 1 : 0} ${shrink ? 1 : 0} auto`,
    }),
    fieldValidationWrapper: css({
      marginTop: theme.spacing(0.5),
    }),
    validationMessageHorizontalOverflow: css({
      width: 0,
      overflowX: 'visible',

      '& > *': {
        whiteSpace: 'nowrap',
      },
    }),
  };
};
