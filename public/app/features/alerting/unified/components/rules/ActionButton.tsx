import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Button, ButtonProps } from '@grafana/ui/src/components/Button';

type Props = Omit<ButtonProps, 'variant' | 'size'>;

export const ActionButton = ({ className, ...restProps }: Props) => {
  const styles = useStyles2(getStyle);
  return <Button variant="secondary" size="xs" className={cx(styles.wrapper, className)} {...restProps} />;
};

export const getStyle = (theme: GrafanaTheme2) => ({
  wrapper: css({
    height: '24px',
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
