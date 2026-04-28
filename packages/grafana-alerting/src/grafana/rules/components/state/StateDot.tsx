import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

interface DotStylesProps {
  color: 'success' | 'error' | 'warning' | 'unknown' | 'info';
}

const StateDot = ({ color }: DotStylesProps) => {
  const styles = useStyles2(getDotStyles, { color });

  return (
    <Stack direction="row" gap={0.5}>
      <div className={styles.dot} />
    </Stack>
  );
};

const getDotStyles = (theme: GrafanaTheme2, { color }: DotStylesProps) => {
  const size = theme.spacing(1.25);
  const outlineSize = `calc(${size} / 2.5)`;

  const errorStyle = color === 'error';
  const successStyle = color === 'success';
  const warningStyle = color === 'warning';
  const infoStyle = color === 'info';

  return {
    dot: css(
      {
        width: size,
        height: size,

        borderRadius: theme.shape.radius.circle,

        backgroundColor: theme.colors.secondary.shade,
        outline: `solid ${outlineSize} ${theme.colors.secondary.transparent}`,
        margin: outlineSize,
      },
      successStyle &&
        css({
          backgroundColor: theme.colors.success.main,
          outlineColor: theme.colors.success.transparent,
        }),
      warningStyle &&
        css({
          backgroundColor: theme.colors.warning.main,
          outlineColor: theme.colors.warning.transparent,
        }),
      errorStyle &&
        css({
          backgroundColor: theme.colors.error.main,
          outlineColor: theme.colors.error.transparent,
        }),
      infoStyle &&
        css({
          backgroundColor: theme.colors.info.main,
          outlineColor: theme.colors.info.transparent,
        })
    ),
  };
};

export { StateDot };
