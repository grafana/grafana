import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme3 } from '../../saga-themes/createTheme';
import { useStyles3 } from '../../themes';
import { Icon } from '../Icon/Icon';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  description?: React.ReactNode;
  category?: React.ReactNode[];
}

export const Label = ({ children, description, className, category, ...labelProps }: LabelProps) => {
  const styles = useStyles3(getLabelStyles);
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

export const getLabelStyles = (theme: GrafanaTheme3) => ({
  label: css({
    label: 'Label',
    font: theme.font.bodySmallStrong,
    marginBottom: theme.spacing[50],
    color: theme.color.content.secondary,
    maxWidth: '480px',
  }),
  labelContent: css({
    display: 'flex',
    alignItems: 'center',
  }),
  description: css({
    label: 'Label-description',
    color: theme.color.content.disabled,
    font: theme.font.bodySmall,
    marginTop: theme.spacing[25],
    display: 'block',
  }),
  categories: css({
    label: 'Label-categories',
    display: 'inline-flex',
    alignItems: 'center',
  }),
  chevron: css({
    margin: `${theme.spacing[0]} ${theme.spacing[25]}`,
  }),
});
