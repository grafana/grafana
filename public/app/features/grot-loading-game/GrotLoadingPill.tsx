import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';
import grotSvg from 'img/grot-news.svg';

import { GrotRunner } from './GrotRunner';

interface Props {
  /** Current loading step, e.g. "Preparing Explore". */
  label: string;
  done: boolean;
  /** Shown in the game when loading finishes, e.g. "Explore is ready". */
  readyLabel: string;
}

/**
 * The fallback loading pill with a Grot badge next to it. Clicking Grot opens a small game
 * to play while waiting. When loading finishes the game stops and offers to continue.
 */
export function GrotLoadingPill({ label, done, readyLabel }: Props) {
  const styles = useStyles2(getStyles);
  const [playing, setPlaying] = useState(false);

  if (done && !playing) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.pill} role="status">
          <Icon name={done ? 'check' : 'spinner'} />
          {label}
        </div>
        <button
          type="button"
          className={cx(styles.badge, playing && styles.badgeActive)}
          onClick={() => setPlaying((p) => !p)}
          aria-expanded={playing}
          aria-label={
            playing
              ? t('grot-loading-game.close-game', 'Close the Grot game')
              : t('grot-loading-game.open-game', 'Play a game with Grot while you wait')
          }
          title={t('grot-loading-game.badge-title', 'Play while you wait')}
        >
          <img src={grotSvg} alt="" className={styles.grot} />
        </button>
      </div>
      {playing && (
        <div className={styles.gameCard}>
          <GrotRunner loadingDone={done} readyLabel={readyLabel} onContinue={() => setPlaying(false)} />
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  pill: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 2),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.text.primary,
    boxShadow: theme.shadows.z2,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  badge: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    padding: 0,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: `0 0 10px ${theme.colors.warning.transparent}`,
    cursor: 'pointer',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['transform', 'box-shadow']),
    },
    '&:hover': {
      transform: 'scale(1.08)',
      boxShadow: `0 0 14px ${theme.colors.warning.main}`,
    },
  }),
  badgeActive: css({
    borderColor: theme.colors.warning.main,
  }),
  grot: css({
    width: 24,
    height: 24,
    transform: 'scaleX(-1)',
  }),
  gameCard: css({
    width: 'min(480px, calc(100vw - 32px))',
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.lg,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
  }),
});
