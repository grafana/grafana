import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

import { SidebarSize } from '../../constants';
import { trackSidebarSizeToggle } from '../../tracking';

import { useCompactOnOverflow } from './useCompactOnOverflow';

interface SidebarHeaderActionsProps {
  sidebarSize: SidebarSize;
  setSidebarSize: (size: SidebarSize) => void;
  /** Changes whenever the children's rendered labels change (e.g. the alerts count). */
  contentKey: string;
  /** Rendered with `compact` so children can drop labels when the header runs out of room. */
  children: (compact: boolean) => ReactNode;
  /** Pinned to the right edge, outside the measured region. */
  trailing?: ReactNode;
}

export function SidebarHeaderActions({
  sidebarSize,
  setSidebarSize,
  contentKey,
  children,
  trailing,
}: SidebarHeaderActionsProps) {
  const styles = useStyles2(getStyles);
  const isMini = sidebarSize === SidebarSize.Mini;
  const { containerRef, contentRef, compact } = useCompactOnOverflow(contentKey);

  return (
    <div className={styles.header}>
      <div className={styles.inner}>
        <IconButton
          name={isMini ? 'maximize-left' : 'compress-alt-left'}
          size="sm"
          variant="secondary"
          onClick={() => {
            trackSidebarSizeToggle(isMini ? 'expand' : 'collapse');
            setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini);
          }}
          aria-label={t('query-editor-next.sidebar.toggle-size', 'Toggle sidebar size')}
        />
        <div ref={containerRef} className={styles.measuredRegion}>
          <div ref={contentRef}>{children(compact)}</div>
        </div>
        {trailing}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    header: css({
      background: theme.colors.background.secondary,
      padding: theme.spacing(0.5, 1.5),
      minHeight: theme.spacing(5),
      display: 'flex',
      alignItems: 'center',
    }),
    inner: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      width: '100%',
    }),
    // The space left over between the fixed buttons — what the children must fit into.
    // Taking all free space is also what keeps `trailing` pinned to the right edge.
    measuredRegion: css({
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      display: 'flex',
    }),
  };
}
