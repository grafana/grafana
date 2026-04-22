import { cx, css } from '@emotion/css';
import { cloneElement, type ReactNode, useId } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { getChildId } from '../../utils/reactUtils';
import { type PopoverContent } from '../Tooltip/types';

import { type FieldProps } from './Field';
import { FieldContext, type FieldContextType } from './FieldContext';
import { FieldValidationMessage } from './FieldValidationMessage';
import { InlineLabel } from './InlineLabel';
import { RadioButtonGroup } from './RadioButtonGroup/RadioButtonGroup';

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
  error?: ReactNode;
  htmlFor?: string;
  /** Make tooltip interactive */
  interactive?: boolean;
}

/**
 * A basic component for rendering form elements, like `Input`, `Checkbox`, `Combobox`, etc, inline together with `InlineLabel`. If the child element has `id` specified, the label's `htmlFor` attribute, pointing to the id, will be added.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/forms-inlinefield--docs
 */
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
  const fieldId = useId();
  const labelId = useId();
  const inputId = htmlFor ?? getChildId(children) ?? fieldId;
  const useFieldset = children.type === RadioButtonGroup;

  const labelElement =
    typeof label === 'string' ? (
      <InlineLabel
        interactive={interactive}
        width={labelWidth}
        tooltip={tooltip}
        htmlFor={inputId}
        transparent={transparent}
        id={labelId}
        as={useFieldset ? 'span' : 'label'}
      >
        {`${label}${required ? ' *' : ''}`}
      </InlineLabel>
    ) : (
      label
    );

  const fieldContextValue: FieldContextType = {
    id: inputId,
    invalid,
    disabled,
    loading,
    'aria-labelledby': useFieldset ? labelId : undefined,
  };

  const Wrapper = useFieldset ? 'fieldset' : 'div';

  return (
    <FieldContext.Provider value={fieldContextValue}>
    <Wrapper className={cx(styles.container, className)} {...htmlProps}>
      {labelElement}
      <div className={styles.childContainer}>
        {/* @deprecated — passing props via children is discouraged and will be removed at some point, use FieldContext instead */}
        {cloneElement(children, { invalid, disabled, loading, 'aria-labelledby': useFieldset ? labelId : undefined })}
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
    </Wrapper>
    </FieldContext.Provider>
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
