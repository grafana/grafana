import { css, cx } from '@emotion/css';
import { ComponentProps, HTMLAttributes } from 'react';

import { Icon, IconName, Stack, Text, useStyles2 } from '@grafana/ui';

interface Props extends HTMLAttributes<HTMLDivElement> {
  icon?: IconName;
  direction?: 'row' | 'column';
  color?: ComponentProps<typeof Text>['color'];
}

const MetaText = ({ children, icon, color = 'secondary', direction = 'row', ...rest }: Props) => {
  const styles = useStyles2(getStyles);
  const interactive = typeof rest.onClick === 'function';

  const rowDirection = direction === 'row';
  const alignItems = rowDirection ? 'center' : 'flex-start';
  const gap = rowDirection ? 0.5 : 0;

  return (
    <div
      className={cx({
        [styles.interactive]: interactive,
      })}
      // allow passing ARIA and data- attributes
      {...rest}
    >
      <Text variant="bodySmall" color={color}>
        <Stack direction={direction} alignItems={alignItems} gap={gap} wrap={'wrap'}>
          {icon && <Icon size="xs" name={icon} />}
          {children}
        </Stack>
      </Text>
    </div>
  );
};

const getStyles = () => ({
  interactive: css({
    cursor: 'pointer',
  }),
});

export { MetaText };
