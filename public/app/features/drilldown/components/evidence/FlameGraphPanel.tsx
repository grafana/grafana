import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelChrome, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { FLAME_GRAPH } from '../../mockScenario';

export function FlameGraphPanel() {
  const styles = useStyles2(getStyles);

  return (
    <PanelChrome title={t('drilldown-page.evidence.flame-graph', 'Flame graph')}>
      <Stack direction="column" gap={1.5}>
        <div className={styles.levels}>
          {FLAME_GRAPH.levels.map((frames, level) => (
            <div key={level} className={styles.level}>
              {frames.map((frame) => (
                <Tooltip key={frame.name} content={frame.name}>
                  <div
                    className={styles.frame(frame.color)}
                    style={{ left: `${frame.start * 100}%`, width: `${frame.width * 100}%` }}
                  />
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
        <Text variant="bodySmall" color="secondary">
          {FLAME_GRAPH.path.join(' › ')}
        </Text>
      </Stack>
    </PanelChrome>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  levels: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  }),
  level: css({
    position: 'relative',
    height: 16,
  }),
  frame: (color: string) =>
    css({
      position: 'absolute',
      top: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.sm,
      background: theme.visualization.getColorByName(color),
    }),
});
