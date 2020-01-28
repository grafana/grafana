import React from 'react';
import { Label } from './Label';
import { stylesFactory, useTheme } from '../../themes';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { FieldValidationMessage } from './FieldValidationMessage';

export interface FieldProps {
  /** Form input element, i.e Input or Switch */
  children: React.ReactElement;
  /** Label for the field */
  label?: string;
  /** Description of the field */
  description?: string;
  /** Indicates if field is in invalid state */
  invalid?: boolean;
  /** Indicates if field is in loading state */
  loading?: boolean;
  /** Indicates if field is disabled */
  disabled?: boolean;
  /** Indicates if field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Indicates horizontal layout of the field */
  horizontal?: boolean;
  className?: string;
}

export const getFieldStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    field: css`
      display: flex;
      flex-direction: column;
      margin-bottom: ${theme.spacing.formSpacingBase * 2}px;
    `,
    fieldHorizontal: css`
      flex-direction: row;
      justify-content: space-between;
      flex-wrap: wrap;
    `,
    fieldValidationWrapper: css`
      margin-top: ${theme.spacing.formSpacingBase / 2}px;
    `,
    fieldValidationWrapperHorizontal: css`
      flex: 1 1 100%;
    `,
  };
});

export const Field: React.FC<FieldProps> = ({
  label,
  description,
  horizontal,
  invalid,
  loading,
  disabled,
  required,
  error,
  children,
  className,
}) => {
  const theme = useTheme();
  let inputId;
  const styles = getFieldStyles(theme);

  // Get the first, and only, child to retrieve form input's id
  const child = React.Children.map(children, c => c)[0];

  if (child) {
    // Retrieve input's id to apply on the label for correct click interaction
    inputId = (child as React.ReactElement<{ id?: string }>).props.id;
  }

  return (
    <div className={cx(styles.field, horizontal && styles.fieldHorizontal, className)}>
      {label && (
        <Label htmlFor={inputId} description={description}>
          {`${label}${required ? ' *' : ''}`}
        </Label>
      )}
      <div>
        {React.cloneElement(children, { invalid, disabled, loading })}
        {invalid && error && !horizontal && (
          <div className={styles.fieldValidationWrapper}>
            <FieldValidationMessage>{error}</FieldValidationMessage>
          </div>
        )}
      </div>

      {invalid && error && horizontal && (
        <div className={cx(styles.fieldValidationWrapper, styles.fieldValidationWrapperHorizontal)}>
          <FieldValidationMessage>{error}</FieldValidationMessage>
        </div>
      )}
    </div>
  );
};
