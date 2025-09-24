import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  description?: React.ReactNode;
  category?: React.ReactNode[];
}

export const Label = ({ children, description, className, category, ...labelProps }: LabelProps) => {
  const styles = useStyles2(getLabelStyles);
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

export const getLabelStyles = (theme: GrafanaTheme2) => ({
  label: css({
    label: 'Label',
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1.25,
    marginBottom: theme.spacing(0.5),
    color: theme.colors.text.primary,
    maxWidth: '480px',
  }),
  labelContent: css({
    display: 'flex',
    alignItems: 'center',
  }),
  description: css({
    label: 'Label-description',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.fontWeightRegular,
    marginTop: theme.spacing(0.25),
    display: 'block',
  }),
  categories: css({
    label: 'Label-categories',
    display: 'inline-flex',
    alignItems: 'center',
  }),
  chevron: css({
    margin: theme.spacing(0, 0.25),
  }),
});
