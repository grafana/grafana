import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LinkButton, PanelChrome, Stack, Text, useStyles2 } from '@grafana/ui';

import { TRACE } from '../../mockScenario';

const LABEL_WIDTH = 150;
const DURATION_WIDTH = 48;

interface Props {
  tracesUrl?: string;
}

export function SpanWaterfallPanel({ tracesUrl }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <PanelChrome
      title={t('drilldown-page.evidence.slow-request', 'Slow request: {{name}}', {
        name: TRACE.name,
        interpolation: { escapeValue: false },
      })}
      actions={
        <Stack gap={1.5} alignItems="center">
          <span className={styles.slow}>{formatDuration(TRACE.durationMs)}</span>
          {tracesUrl && (
            <LinkButton href={tracesUrl} size="sm" variant="secondary">
              {t('drilldown-page.evidence.explore-traces', 'Explore traces')}
            </LinkButton>
          )}
        </Stack>
      }
    >
      <Stack direction="column" gap={1}>
        <div className={styles.row}>
          <span className={styles.label} />
          <div className={styles.ticks}>
            {TRACE.axisTicks.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
          <span className={styles.duration} />
        </div>
        {TRACE.spans.map((span) => {
          const isSlow = span.depth > 0 && span.durationMs > TRACE.slowThresholdMs;
          return (
            <div key={`${span.service}-${span.operation}`} className={styles.row}>
              <span className={styles.label} style={{ paddingLeft: span.depth * 12 }}>
                <Text variant="bodySmall" weight="medium">
                  {span.service}
                </Text>{' '}
                <Text variant="bodySmall" color="secondary">
                  {span.operation}
                </Text>
              </span>
              <div className={styles.track}>
                <div
                  className={styles.bar(span.color)}
                  style={{
                    left: `${(span.startMs / TRACE.durationMs) * 100}%`,
                    width: `${(span.durationMs / TRACE.durationMs) * 100}%`,
                  }}
                />
              </div>
              <span className={isSlow ? styles.slowDuration : styles.duration}>{formatDuration(span.durationMs)}</span>
            </div>
          );
        })}
        <Text variant="bodySmall" color="secondary">
          {TRACE.summary}
        </Text>
      </Stack>
    </PanelChrome>
  );
}

function formatDuration(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

const getStyles = (theme: GrafanaTheme2) => {
  const duration = css({
    width: DURATION_WIDTH,
    flexShrink: 0,
    textAlign: 'right',
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  });

  return {
    row: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    label: css({
      width: LABEL_WIDTH,
      flexShrink: 0,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      lineHeight: theme.typography.bodySmall.lineHeight,
    }),
    ticks: css({
      flex: 1,
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    track: css({
      position: 'relative',
      flex: 1,
      height: 12,
      borderRadius: theme.shape.radius.sm,
      background: theme.colors.background.secondary,
    }),
    bar: (color: string) =>
      css({
        position: 'absolute',
        top: 0,
        bottom: 0,
        minWidth: 4,
        borderRadius: theme.shape.radius.sm,
        background: theme.visualization.getColorByName(color),
      }),
    duration,
    slowDuration: css(duration, { color: theme.colors.error.text }),
    slow: css({
      color: theme.colors.error.text,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
};
