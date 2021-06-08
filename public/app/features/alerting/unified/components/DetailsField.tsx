import React, { FC } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';

interface Props {
  label: React.ReactNode;
  className?: string;
  horizontal?: boolean;
}

export const DetailsField: FC<Props> = ({ className, label, horizontal, children }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={cx(className, styles.field, horizontal ? styles.fieldHorizontal : styles.fieldVertical)}>
      <div>{label}</div>
      <div>{children}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  fieldHorizontal: css`
    flex-direction: row;
  `,
  fieldVertical: css`
    flex-direction: column;
  `,
  field: css`
    display: flex;
    margin: ${theme.spacing.md} 0;

    & > div:first-child {
      width: 110px;
      padding-right: ${theme.spacing.sm};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
      line-height: 1.8;
    }
    & > div:nth-child(2) {
      flex: 1;
      color: ${theme.colors.textSemiWeak};
    }
  `,
});
