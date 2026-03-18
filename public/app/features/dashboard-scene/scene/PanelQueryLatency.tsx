import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { Icon, PanelChrome, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

export class PanelQueryLatency extends SceneObjectBase<SceneObjectState> {
  public static Component = PanelQueryLatencyRenderer;
}

function PanelQueryLatencyRenderer({ model }: SceneComponentProps<PanelQueryLatency>) {
  const { showQueryLatency } = getDashboardSceneFor(model).useState();
  const dataObject = sceneGraph.getData(model);
  const { data } = dataObject.useState();
  const styles = useStyles2(getStyles);

  const isLoading = data?.state === LoadingState.Loading;
  const startTime = data?.request?.startTime;

  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (!isLoading || !startTime) {
      return;
    }
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(interval);
  }, [isLoading, startTime]);

  if (!showQueryLatency || !data?.request?.startTime) {
    return null;
  }

  let ms: number;
  let running: boolean;

  if (data.state === LoadingState.Done && data.request.endTime) {
    ms = data.request.endTime - data.request.startTime;
    running = false;
  } else if (isLoading) {
    ms = elapsed;
    running = true;
  } else {
    return null;
  }

  const label = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  const tooltipText = running
    ? t('panel-query-latency.tooltip-running', 'Query running: {{ms}}ms', { ms })
    : t('panel-query-latency.tooltip', 'Query time: {{ms}}ms', { ms });

  return (
    <Tooltip content={tooltipText}>
      <PanelChrome.TitleItem>
        <Stack gap={0.5} alignItems="center">
          <Icon name="tachometer-fast" size="sm" />
          <span className={running ? styles.latencyRunning : styles.latency}>{label}</span>
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
  latencyRunning: css({
    color: theme.colors.text.disabled,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
  }),
});
