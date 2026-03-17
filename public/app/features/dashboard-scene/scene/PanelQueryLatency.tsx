import { css } from '@emotion/css';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { Icon, PanelChrome, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

export class PanelQueryLatency extends SceneObjectBase<SceneObjectState> {
  public static Component = PanelQueryLatencyRenderer;
}

function PanelQueryLatencyRenderer({ model }: SceneComponentProps<PanelQueryLatency>) {
  const dashboard = getDashboardSceneFor(model);
  const { showQueryLatency } = dashboard.useState();
  const dataObject = sceneGraph.getData(model);
  const { data } = dataObject.useState();
  const styles = useStyles2(getStyles);

  if (!showQueryLatency || !data || data.state !== LoadingState.Done || !data.request?.endTime) {
    return null;
  }

  const ms = data.request.endTime - data.request.startTime;
  const label = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  return (
    <Tooltip content={t('panel-query-latency.tooltip', 'Query time: {{ms}}ms', { ms })}>
      <PanelChrome.TitleItem>
        <Stack gap={0.5} alignItems="center">
          <Icon name="tachometer-fast" size="sm" />
          <span className={styles.latency}>{label}</span>
        </Stack>
      </PanelChrome.TitleItem>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  latency: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
  }),
});
