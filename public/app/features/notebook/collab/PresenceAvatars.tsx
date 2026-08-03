import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { type RemotePeer } from './types';

interface Props {
  peers: RemotePeer[];
  /** Session id of the peer currently being followed, if any. */
  followedSid?: string | null;
  /** When set, avatars become buttons that toggle following that collaborator. */
  onToggleFollow?: (peer: RemotePeer) => void;
}

/** Compact row of colored initials for everyone else connected to the notebook. */
export function PresenceAvatars({ peers, followedSid, onToggleFollow }: Props) {
  const styles = useStyles2(getStyles);

  if (peers.length === 0) {
    return null;
  }

  return (
    <div className={styles.row} data-testid="notebook-presence">
      {peers.map((peer) => {
        const label = peer.user.name || peer.user.login;
        const following = followedSid === peer.sid;
        const tooltip = onToggleFollow
          ? following
            ? t('notebooks.presence.stop-following', 'Following {{name}} — click to stop', { name: label })
            : t('notebooks.presence.click-to-follow', '{{name}} is in this notebook — click to follow', {
                name: label,
              })
          : t('notebooks.presence.viewing', '{{name}} is in this notebook', { name: label });

        if (!onToggleFollow) {
          return (
            <Tooltip key={peer.sid} content={tooltip}>
              <span className={styles.avatar} style={{ backgroundColor: peer.color }}>
                {initials(label)}
              </span>
            </Tooltip>
          );
        }

        return (
          <Tooltip key={peer.sid} content={tooltip}>
            <button
              type="button"
              className={cx(styles.avatar, styles.clickable, following && styles.following)}
              style={{ backgroundColor: peer.color, ...(following ? { outlineColor: peer.color } : {}) }}
              onClick={() => onToggleFollow(peer)}
              aria-label={tooltip}
              aria-pressed={following}
            >
              {initials(label)}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',

    '& > * + *': {
      marginLeft: -6,
    },
  }),
  avatar: css({
    width: 26,
    height: 26,
    borderRadius: theme.shape.radius.circle,
    border: `2px solid ${theme.colors.background.primary}`,
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'default',
    padding: 0,
  }),
  clickable: css({
    cursor: 'pointer',

    '&:hover': {
      transform: 'scale(1.1)',
    },
  }),
  following: css({
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineOffset: 1,
  }),
});
