import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, IconName, useStyles2 } from '@grafana/ui';

interface MataTextProps {
  icon?: IconName;
}

const MetaText: FC<MataTextProps> = ({ children, icon }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.metaText}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        {icon && <Icon name={icon} />}
        {children}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  metaText: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
  `,
});

export { MetaText };
