import { css } from '@emotion/css';
import classNames from 'classnames';
import React, { FC, HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, IconName, useStyles2 } from '@grafana/ui';

interface MetaTextProps extends HTMLAttributes<HTMLDivElement> {
  icon?: IconName;
}

const MetaText: FC<MetaTextProps> = ({ children, icon, ...rest }) => {
  const styles = useStyles2(getStyles);
  const interactive = typeof rest.onClick === 'function';

  return (
    <div
      className={classNames({
        [styles.metaText]: true,
        [styles.interactive]: interactive,
      })}
      {...rest}
    >
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
  interactive: css`
    cursor: pointer;

    &:hover {
      color: ${theme.colors.text.primary};
    }
  `,
});

export { MetaText };
