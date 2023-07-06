import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2, stylesFactory } from '../../themes';
import { Icon } from '../Icon/Icon';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  description?: React.ReactNode;
  category?: React.ReactNode[];
}

export const getLabelStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    label: css`
      label: Label;
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
      line-height: 1.25;
      margin-bottom: ${theme.spacing(0.5)};
      color: ${theme.colors.text.primary};
      max-width: 480px;
    `,
    labelContent: css`
      display: flex;
      align-items: center;
    `,
    description: css`
      label: Label-description;
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightRegular};
      margin-top: ${theme.spacing(0.25)};
      display: block;
    `,
    categories: css`
      label: Label-categories;
      display: inline-flex;
      align-items: center;
    `,
    chevron: css`
      margin: 0 ${theme.spacing(0.25)};
    `,
  };
});

export const Label = ({ children, description, className, category, ...labelProps }: LabelProps) => {
  const theme = useTheme2();
  const styles = getLabelStyles(theme);
  const categories = category?.map((c, i) => {
    return (
      <span className={styles.categories} key={`${c}/${i}`}>
        <span>{c}</span>
        <Icon name="angle-right" className={styles.chevron} />
      </span>
    );
  });

  return (
    <div className={cx(styles.label, className)}>
      <label {...labelProps}>
        <div className={styles.labelContent}>
          {categories}
          {children}
        </div>
        {description && <span className={styles.description}>{description}</span>}
      </label>
    </div>
  );
};
