import { css } from '@emotion/css';

import { type GrafanaTheme2, colorManipulator } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { type KindInfo } from '../kinds';

interface Props {
  info: KindInfo;
  size?: 'sm' | 'md';
}

export function KindIcon({ info, size = 'md' }: Props) {
  const styles = useStyles2(getStyles, info.color, size);
  return (
    <span className={styles.box} aria-hidden>
      <Icon name={info.icon} size={size === 'sm' ? 'xs' : 'sm'} />
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2, colorName: string | undefined, size: 'sm' | 'md') => {
  const color = colorName ? theme.visualization.getColorByName(colorName) : theme.colors.text.secondary;
  const box = size === 'sm' ? 18 : 22;
  return {
    box: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: box,
      height: box,
      borderRadius: theme.shape.radius.default,
      color,
      background: colorManipulator.alpha(color, 0.15),
    }),
  };
};
