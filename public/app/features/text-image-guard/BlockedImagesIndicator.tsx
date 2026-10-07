import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { getPanelIdForVizPanel } from 'app/features/dashboard-scene/utils/utils-panels';

import { usePanelBlockedHostCount } from './imageGuardStore';

// Temporary preview switches for comparing options, e.g. ?blockedIndicatorColor=red&blockedIndicatorPosition=right
function getPreviewOptions() {
  const params = new URLSearchParams(window.location.search);
  return {
    color: params.get('blockedIndicatorColor') === 'red' ? 'red' : 'yellow',
    position: params.get('blockedIndicatorPosition') === 'right' ? 'right' : 'title',
  };
}

export function isRightPositionPreview() {
  return getPreviewOptions().position === 'right';
}

/** Mirrors PanelStatus in the panel header, for panels holding back images from unapproved sources. */
export function BlockedImagesStatusIcon({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getStyles);
  const count = usePanelBlockedHostCount(String(getPanelIdForVizPanel(panel)));

  if (count === 0) {
    return null;
  }

  const isRed = getPreviewOptions().color === 'red';

  return (
    <Button
      variant={isRed ? 'destructive' : 'secondary'}
      className={isRed ? undefined : styles.warning}
      icon="exclamation-triangle"
      size="sm"
      tooltip={t('text-image-guard.indicator.tooltip', '', {
        count,
        defaultValue_one: '{{count}} source is currently blocked. Images will not render',
        defaultValue_other: '{{count}} sources are currently blocked. Images will not render',
      })}
      aria-label={t('text-image-guard.indicator.aria-label', 'Blocked image sources')}
    />
  );
}

/** Title item that shows the blocked images icon right after the panel title. */
export class BlockedImagesTitleItem extends SceneObjectBase {
  static Component = BlockedImagesTitleItemRenderer;

  constructor() {
    super({});
  }
}

function BlockedImagesTitleItemRenderer({ model }: SceneComponentProps<BlockedImagesTitleItem>) {
  const panel = model.parent;

  if (!(panel instanceof VizPanel) || isRightPositionPreview()) {
    return null;
  }

  return <BlockedImagesStatusIcon panel={panel} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Same treatment PanelStatus gives its warning severity.
  warning: css({
    color: theme.colors.warning.text,
  }),
});
