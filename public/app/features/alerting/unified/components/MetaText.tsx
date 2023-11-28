import { css, cx } from '@emotion/css';
import React, { ComponentProps, HTMLAttributes } from 'react';

import { Stack } from '@grafana/experimental';
import { Icon, IconName, useStyles2, Text } from '@grafana/ui';

interface Props extends HTMLAttributes<HTMLDivElement> {
  icon?: IconName;
  color?: ComponentProps<typeof Text>['color'];
}

const MetaText = ({ children, icon, color = 'secondary', ...rest }: Props) => {
  const styles = useStyles2(getStyles);
  const interactive = typeof rest.onClick === 'function';

  return (
    <div
      className={cx({
        [styles.interactive]: interactive,
      })}
      // allow passing ARIA and data- attributes
      {...rest}
    >
      <Text variant="bodySmall" color={color}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {icon && <Icon size="sm" name={icon} />}
          {children}
        </Stack>
      </Text>
    </div>
  );
};

const getStyles = () => ({
  interactive: css`
    cursor: pointer;
  `,
});

export { MetaText };
