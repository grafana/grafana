import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Field, RadioButtonGroup, Stack, Text, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types/store';

import { GrotLoadingPill } from './GrotLoadingPill';

// 0 means the load never finishes, handy for playing without interruption.
const DURATIONS = [
  { label: '10s', value: 10_000 },
  { label: '30s', value: 30_000 },
  { label: '2m', value: 120_000 },
  { label: '∞', value: 0 },
];

/**
 * Local playground for the fallback loading flow with the Grot game. It fakes a slow
 * Explore load so the pill, badge and game can be tried without a cold backend.
 */
export default function GrotLoadingGamePage() {
  const styles = useStyles2(getStyles);
  const navIndex = useSelector((state) => state.navIndex);
  const homeNav = getNavModel(navIndex, HOME_NAV_ID).main;
  const navModel = {
    text: t('grot-loading-game.title', 'Grot loading game'),
    parentItem: homeNav,
  };

  const [duration, setDuration] = useState(DURATIONS[1].value);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - startedAt;
  const done = duration > 0 && elapsed >= duration;
  // Mirrors the prototype: "Preparing" first, then "Loading" for the second half.
  const label = done
    ? t('grot-loading-game.label-ready', 'Explore is ready')
    : duration > 0 && elapsed > duration / 2
      ? t('grot-loading-game.label-loading', 'Loading Explore')
      : t('grot-loading-game.label-preparing', 'Preparing Explore');

  const restart = () => {
    setStartedAt(Date.now());
    setNow(Date.now());
  };

  return (
    <Page navModel={{ node: navModel, main: navModel }}>
      <Stack direction="column" gap={2}>
        <Stack alignItems="flex-end" gap={2} wrap="wrap">
          <Field noMargin label={t('grot-loading-game.label-duration', 'Fake load time')}>
            <RadioButtonGroup
              options={DURATIONS}
              value={duration}
              onChange={(v) => {
                setDuration(v);
                restart();
              }}
            />
          </Field>
          <Button variant="secondary" icon="sync" onClick={restart}>
            {t('grot-loading-game.restart', 'Restart loading')}
          </Button>
        </Stack>

        <div className={styles.frame}>
          <div className={styles.pillSlot}>
            <GrotLoadingPill
              label={label}
              done={done}
              readyLabel={t('grot-loading-game.label-ready', 'Explore is ready')}
            />
          </div>
          {done ? (
            <div className={styles.loaded}>
              <Text color="secondary">{t('grot-loading-game.loaded', 'Explore would render here.')}</Text>
            </div>
          ) : (
            <Stack direction="column" gap={2}>
              <Skeleton height={32} width="40%" />
              <Skeleton height={260} />
              <Skeleton count={4} />
            </Stack>
          )}
        </div>
      </Stack>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  frame: css({
    position: 'relative',
    minHeight: 480,
    padding: theme.spacing(8, 2, 2),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  pillSlot: css({
    position: 'absolute',
    top: theme.spacing(2),
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1,
  }),
  loaded: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 360,
  }),
});
