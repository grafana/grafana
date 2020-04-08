import React from 'react';
import { useTheme, stylesFactory } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { Icon } from '../Icon/Icon';
import tinycolor from 'tinycolor2';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: string;
  description?: string;
  category?: string[];
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
      margin-top: ${theme.spacing.xxs};
      display: block;
    `,
    categories: css`
      color: ${theme.isLight
        ? tinycolor(theme.colors.formLabel)
            .lighten(10)
            .toHexString()
        : tinycolor(theme.colors.formLabel)
            .darken(10)
            .toHexString()};
      display: inline-flex;
      align-items: center;
    `,
    chevron: css`
      margin: 0 ${theme.spacing.xxs};
    `,
  };
});

export const Label: React.FC<LabelProps> = ({ children, description, className, category, ...labelProps }) => {
  const theme = useTheme();
  const styles = getLabelStyles(theme);
  const categories = category?.map(c => {
    return (
      <span className={styles.categories}>
        <span>{c}</span>
        <Icon name="angle-right" className={styles.chevron} />
      </span>
    );
  });

  return (
    <div className={cx(styles.label, className)}>
      <label {...labelProps}>
        {categories}
        {children}
        {description && <span className={styles.description}>{description}</span>}
      </label>
    </div>
  );
};
