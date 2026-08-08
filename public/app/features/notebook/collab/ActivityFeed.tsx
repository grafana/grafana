import { css } from '@emotion/css';
import { useState } from 'react';

import { dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { IconButton, Text, Toggletip, useStyles2 } from '@grafana/ui';

import { type ActivityEvent } from './types';

interface Props {
  activity: ActivityEvent[];
  /** Scrolls to the block an entry refers to. */
  onJumpToCell?: (cellKey: string) => void;
}

/**
 * Toolbar popover showing the session's shared activity feed: who added, moved
 * or changed which block, newest first. Session-scoped by design — history that
 * matters long-term lives in the saved notebook, not here.
 */
export function ActivityFeedButton({ activity, onJumpToCell }: Props) {
  const styles = useStyles2(getStyles);
  const [open, setOpen] = useState(false);

  const content = (
    <div className={styles.panel}>
      {activity.length === 0 ? (
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="notebooks.activity.empty">Edits made while this notebook is open will show up here.</Trans>
        </Text>
      ) : (
        <ul className={styles.list}>
          {activity.map((event) => {
            const name = event.user.name || event.user.login;
            const row = (
              <>
                <span className={styles.dot} style={{ backgroundColor: event.color }} />
                <span className={styles.text}>
                  <strong>{name}</strong> {event.label}
                </span>
                <span className={styles.when}>{dateTimeFormatTimeAgo(event.ts)}</span>
              </>
            );

            return (
              <li key={event.id}>
                {event.cellKey && onJumpToCell ? (
                  <button
                    type="button"
                    className={styles.rowButton}
                    onClick={() => {
                      onJumpToCell(event.cellKey!);
                      setOpen(false);
                    }}
                  >
                    {row}
                  </button>
                ) : (
                  <span className={styles.row}>{row}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <Toggletip
      content={content}
      title={t('notebooks.activity.title', 'Activity')}
      placement="bottom-end"
      closeButton={false}
      show={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      <IconButton name="list-ul" size="lg" tooltip={t('notebooks.activity.tooltip', 'Activity')} />
    </Toggletip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    width: 300,
    maxHeight: 320,
    overflow: 'auto',
  }),
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  row: css({
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 0.5),
    width: '100%',
  }),
  rowButton: css({
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 0.5),
    width: '100%',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    color: 'inherit',
    borderRadius: theme.shape.radius.default,

    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  dot: css({
    width: 8,
    height: 8,
    borderRadius: theme.shape.radius.circle,
    flexShrink: 0,
    alignSelf: 'center',
  }),
  text: css({
    flex: 1,
    minWidth: 0,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
  }),
  when: css({
    flexShrink: 0,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
});
