import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '@grafana/ui';

export interface FieldProps {
  children: React.ReactElement;
  label?: string;
  invalid?: boolean;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const getFieldStyles = stylesFactory((theme: GrafanaTheme) => ({
  label: css`
    font-size: ${theme.typography.size.md};
    font-weight: ${theme.typography.weight.semibold};
    line-height: 1.25;
    margin: ${theme.spacing.formLabelMargin};
    padding: ${theme.spacing.formLabelPadding};
    color: ${theme.colors.formLabel};
    max-width: 480px;
  `,
  labelContent: css`
    display: flex;
    align-items: center;
  `,
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
}));

export const Field: React.FC<FieldProps> = ({ label, invalid, loading, disabled, required, children, className }) => {
  const theme = useTheme();
  let inputId: string | undefined;
  const styles = getFieldStyles(theme);

  // Get the first, and only, child to retrieve form input's id
  const child = React.Children.map(children, (c) => c)![0];

  if (child) {
    // Retrieve input's id to apply on the label for correct click interaction
    inputId = (child as React.ReactElement<{ id?: string }>).props.id;
  }

  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <div className={cx(styles.label, className)}>
          <label htmlFor={inputId}>
            <div className={styles.labelContent}>{`${label}${required ? ' *' : ''}`}</div>
          </label>
        </div>
      )}
      <div>{React.cloneElement(children, { invalid, disabled, loading })}</div>
    </div>
  );
};
