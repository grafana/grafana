import React from 'react';
import { useTheme, stylesFactory } from '../../themes';
import { GrafanaTheme } from '../../types';
import { css, cx } from 'emotion';

export interface LabelProps extends React.HTMLAttributes<HTMLLabelElement> {
  children: string;
  description?: string;
}

export const getLabelStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    label: css`
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
      margin: ${theme.spacing.formLabelMargin};
      padding: ${theme.spacing.formLabelPadding};
      color: ${theme.colors.formLabel};
    `,
    description: css`
      font-weight: ${theme.typography.weight.regular};
    `,
  };
});

export const Label: React.FC<LabelProps> = ({ children, description, className, ...labelProps }) => {
  const theme = useTheme();
  console.log(theme);
  const styles = getLabelStyles(theme);

  return (
    <div className={cx(styles.label, className)}>
      <label {...labelProps}>{children}</label>
      {description && <div className={styles.description}>{description}</div>}
    </div>
  );
};
