import { css } from '@emotion/css';
import React, { ReactNode } from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, useStyles2 } from '@grafana/ui';

interface Props {
  icon?: IconName;
  label?: ReactNode;
  value: ReactNode;
  color?: string;
}

// TODO allow customization with color prop
const Label = ({ label, value, icon }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.meta().wrapper}>
      <Stack direction="row" gap={0} alignItems="stretch">
        <div className={styles.meta().label}>
          <Stack direction="row" gap={0.5} alignItems="center">
            {icon && <Icon name={icon} />} {label ?? ''}
          </Stack>
        </div>
        <div className={styles.meta().value}>{value}</div>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  meta: (color?: string) => ({
    wrapper: css`
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    label: css`
      display: flex;
      align-items: center;

      padding: ${theme.spacing(0.33)} ${theme.spacing(1)};
      background: ${theme.colors.secondary.transparent};

      border: solid 1px ${theme.colors.border.medium};
      border-top-left-radius: ${theme.shape.borderRadius(2)};
      border-bottom-left-radius: ${theme.shape.borderRadius(2)};
    `,
    value: css`
      padding: ${theme.spacing(0.33)} ${theme.spacing(1)};
      font-weight: ${theme.typography.fontWeightBold};

      border: solid 1px ${theme.colors.border.medium};
      border-left: none;
      border-top-right-radius: ${theme.shape.borderRadius(2)};
      border-bottom-right-radius: ${theme.shape.borderRadius(2)};
    `,
  }),
});

export { Label };
