import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';

interface DotStylesProps {
  color: 'success' | 'error' | 'warning' | 'info';
  includeState?: boolean;
}

const AlertStateDot = ({ color, includeState }: DotStylesProps) => {
  const styles = useStyles2(getDotStyles, { color, includeState });

  return (
    <Stack direction="row" gap={0.5}>
      <div className={styles.dot} />
    </Stack>
  );
};

const getDotStyles = (theme: GrafanaTheme2, props: DotStylesProps) => {
  const size = theme.spacing(1.25);
  const outlineSize = `calc(${size} / 2.5)`;

  const errorStyle = props.color === 'error';
  const successStyle = props.color === 'success';
  const warningStyle = props.color === 'warning';

  return {
    dot: css(
      {
        width: size,
        height: size,

        // eslint-disable-next-line @grafana/no-border-radius-literal
        borderRadius: '100%',

        backgroundColor: theme.colors.secondary.main,
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
        })
    ),
  };
};

export { AlertStateDot };
