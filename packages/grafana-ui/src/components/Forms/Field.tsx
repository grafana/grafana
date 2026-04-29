import { css, cx } from '@emotion/css';
import { useId, type HTMLAttributes } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getChildId } from '../../utils/reactUtils';

import { FieldContext } from './FieldContext';
import { FieldValidationMessage } from './FieldValidationMessage';
import { Label, getLabelStyles } from './Label';
import { RadioButtonGroup } from './RadioButtonGroup/RadioButtonGroup';

type ChildProps = Record<string, unknown>;

export interface FieldProps extends HTMLAttributes<HTMLElement> {
  /** Form input element, i.e Input or Switch */
  children: React.ReactElement<ChildProps>;
  /** Label for the field */
  label?: React.ReactNode;
  /** Description of the field */
  description?: React.ReactNode;
  /** Indicates if field is in invalid state */
  invalid?: boolean;
  /** Indicates if field is in loading state */
  loading?: boolean;
  /** Indicates if field is disabled */
  disabled?: boolean;
  /** Indicates if field is required */
  required?: boolean;
  /** Error message to display */
  error?: React.ReactNode;
  /** Indicates horizontal layout of the field */
  horizontal?: boolean;
  /** make validation message overflow horizontally. Prevents pushing out adjacent inline components */
  validationMessageHorizontalOverflow?: boolean;
  /** Whether to use a <fieldset> + <legend> for rendering the label. Only use for RadioButtonGroup */
  useFieldset?: boolean;

  className?: string;
  /**
   *  A unique id that associates the label of the Field component with the control with the unique id.
   *  If the `htmlFor` property is missing the `htmlFor` will be inferred from the `id` or `inputId` property of the first child.
   *  https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label#attr-for
   */
  htmlFor?: string;
  /** Remove the bottom margin */
  noMargin?: boolean;
}

/**
 * Field is the basic component for rendering form elements together with labels and description.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/forms-field--docs
 */
export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  (
    {
      label: labelProp,
      description,
      horizontal,
      invalid,
      loading,
      disabled,
      required,
      error,
      children,
      className,
      validationMessageHorizontalOverflow,
      htmlFor,
      noMargin,
      useFieldset: useFieldsetProp,
      ...otherProps
    }: FieldProps,
    ref
  ) => {
    const styles = useStyles2(getFieldStyles, noMargin);
    const labelStyles = useStyles2(getLabelStyles);
    const useFieldset = useFieldsetProp ?? children.type === RadioButtonGroup;
    const label = typeof labelProp === 'string' ? `${labelProp}${required ? ' *' : ''}` : labelProp;
    const fieldId = useId();
    const errorId = useId();
    const inputId = htmlFor ?? getChildId(children) ?? fieldId;

    let labelElement = label;

    if (useFieldset) {
      if (typeof label === 'string') {
        labelElement = (
          <legend className={labelStyles.label}>
            <div className={labelStyles.labelContent}>{label}</div>
            {description && <span className={labelStyles.description}>{description}</span>}
          </legend>
        );
      } else {
        labelElement = <legend>{label}</legend>;
      }
    } else if (typeof label === 'string') {
      labelElement = (
        <Label htmlFor={inputId} description={description}>
          {label}
        </Label>
      );
    }

    // @deprecated — passing props via children is discouraged and will be removed at some point, use FieldContext instead
    const childProps: ChildProps = deleteUndefinedProps({ invalid, disabled, loading });
    if (invalid && error) {
      // this should probably use aria-errormessage, but seems like voiceover still doesn't support that...
      childProps['aria-describedby'] = errorId;
    }
    const Wrapper = useFieldset ? 'fieldset' : 'div';
    return (
      <FieldContext.Provider
        value={{
          id: inputId,
          invalid,
          disabled,
          loading,
          'aria-describedby': invalid && error ? errorId : undefined,
        }}
      >
        <Wrapper className={cx(styles.field, horizontal && styles.fieldHorizontal, className)} {...otherProps}>
          {labelElement}
          <div>
            <div ref={ref}>
              {React.cloneElement(children, children.type !== React.Fragment ? childProps : undefined)}
            </div>
            {invalid && error && !horizontal && (
              <div
                className={cx(styles.fieldValidationWrapper, {
                  [styles.validationMessageHorizontalOverflow]: !!validationMessageHorizontalOverflow,
                })}
              >
                <FieldValidationMessage id={errorId}>{error}</FieldValidationMessage>
              </div>
            )}
          </div>

          {invalid && error && horizontal && (
            <div
              className={cx(styles.fieldValidationWrapper, styles.fieldValidationWrapperHorizontal, {
                [styles.validationMessageHorizontalOverflow]: !!validationMessageHorizontalOverflow,
              })}
            >
              <FieldValidationMessage id={errorId}>{error}</FieldValidationMessage>
            </div>
          )}
        </Wrapper>
      </FieldContext.Provider>
    );
  }
);

Field.displayName = 'Field';

function deleteUndefinedProps<T extends Object>(obj: T): Partial<T> {
  for (const key in obj) {
    if (obj[key] === undefined) {
      delete obj[key];
    }
  }

  return obj;
}

export const getFieldStyles = (theme: GrafanaTheme2, noMargin?: boolean) => ({
  field: css({
    display: 'flex',
    flexDirection: 'column',
    marginBottom: theme.spacing(noMargin ? 0 : 2),
  }),
  fieldHorizontal: css({
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  }),
  fieldValidationWrapper: css({
    marginTop: theme.spacing(0.5),
  }),
  fieldValidationWrapperHorizontal: css({
    flex: '1 1 100%',
  }),
  validationMessageHorizontalOverflow: css({
    width: 0,
    overflowX: 'visible',

    '& > *': {
      whiteSpace: 'nowrap',
    },
  }),
});
