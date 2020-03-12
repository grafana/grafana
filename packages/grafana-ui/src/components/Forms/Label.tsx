import React from 'react';
import { useTheme, stylesFactory } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: string;
  description?: string;
}

export const getLabelStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    label: css`
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
      line-height: 1.25;
      margin: ${theme.spacing.formLabelMargin};
      padding: ${theme.spacing.formLabelPadding};
      color: ${theme.colors.formLabel};
      max-width: 480px;
    `,
    description: css`
      color: ${theme.colors.formDescription};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.regular};
      display: block;
    `,
  };
});

export const Label: React.FC<LabelProps> = ({ children, description, className, ...labelProps }) => {
  const theme = useTheme();
  const styles = getLabelStyles(theme);

  return (
    <div className={cx(styles.label, className)}>
      <label {...labelProps}>
        {children}
        {description && <span className={styles.description}>{description}</span>}
      </label>
    </div>
  );
};
