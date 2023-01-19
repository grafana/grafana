import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  label: React.ReactNode;
  className?: string;
  horizontal?: boolean;
}

export const DetailsField = ({ className, label, horizontal, children }: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(className, styles.field, horizontal ? styles.fieldHorizontal : styles.fieldVertical)}>
      <div>{label}</div>
      <div>{children}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  fieldHorizontal: css`
    flex-direction: row;
    ${theme.breakpoints.down('md')} {
      flex-direction: column;
    }
  `,
  fieldVertical: css`
    flex-direction: column;
  `,
  field: css`
    display: flex;
    margin: ${theme.spacing(2)} 0;

    & > div:first-child {
      width: 110px;
      padding-right: ${theme.spacing(1)};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightBold};
      line-height: 1.8;
    }
    & > div:nth-child(2) {
      flex: 1;
      color: ${theme.colors.text.secondary};
    }
  `,
});
