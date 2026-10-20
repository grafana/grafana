import { css } from '@emotion/css';
import { useRef } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2, colorManipulator } from '@grafana/data';
import { type IconName, Card, Icon, Stack, useStyles2, useTheme2 } from '@grafana/ui';

import { ctaClicked } from '../analytics/main';

export interface GuideProps {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  color: string;
  cta: string;
  href: string;
}

export function Guide({ id, title, description, icon, color, cta, href }: GuideProps) {
  const styles = useStyles2(getStyles, color);

  const refGlow = useRef<HTMLDivElement>(null);
  const showGlow = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (refGlow.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const leftPct = ((e.clientX - rect.left) / rect.width) * 100;
      const topPct = ((e.clientY - rect.top) / rect.height) * 100;
      refGlow.current.style.background = `radial-gradient(circle at ${leftPct}% ${topPct}%, ${colorManipulator.alpha(color, 0.2)} 0%, transparent 60%)`;
      refGlow.current.style.opacity = '1';
    }
  };
  const hideGlow = () => {
    if (refGlow.current) {
      refGlow.current.style.opacity = '0';
    }
  };

  return (
    <Card
      noMargin
      href={href}
      className={styles.card}
      onMouseMove={showGlow}
      onMouseLeave={hideGlow}
      onClick={() => ctaClicked({ surface: 'overview', action: 'open_guide', placement: 'card', solution: id })}
    >
      <div className={styles.glow} ref={refGlow} aria-hidden="true" />
      <Card.Heading>
        <Stack direction="row" gap={1} alignItems="center">
          <Icon name={icon} size="xl" className={styles.icon} />
          {title}
        </Stack>
      </Card.Heading>
      <Card.Description>{description}</Card.Description>
      <Card.Actions>
        <div className={styles.cta}>
          {cta}
          <Icon name="arrow-right" size="lg" />
        </div>
      </Card.Actions>
    </Card>
  );
}

export function GuideSkeleton() {
  const theme = useTheme2();

  return (
    <Card noMargin>
      <Card.Heading>
        <Stack direction="row" gap={1} alignItems="center">
          <Skeleton width={theme.spacing(5)} height={theme.spacing(5)} />
          <Skeleton width={theme.spacing(20)} height={theme.spacing(2)} />
        </Stack>
      </Card.Heading>
      <Card.Description>
        <Skeleton width="100%" height={theme.spacing(2)} count={2} />
      </Card.Description>
      <Card.Actions>
        <Skeleton width={theme.spacing(12)} height={theme.spacing(2)} />
      </Card.Actions>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2, color: string) => ({
  card: css({
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',
    border: `1px solid ${colorManipulator.alpha(color, 0.25)}`,
    boxShadow: `0 0 ${theme.spacing(1)} ${colorManipulator.alpha(colorManipulator.darken(color, 0.9), 0.5)}`,

    '&:hover': {
      border: `1px solid ${colorManipulator.alpha(color, 0.5)}`,
    },

    '&::before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: 0,
      background: color,
      opacity: 0.125,
      pointerEvents: 'none',
      zIndex: -1,
    },
  }),
  glow: css({
    position: 'absolute',
    inset: 0,
    opacity: 0,
    pointerEvents: 'none',
    zIndex: -1,

    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity', {
        duration: theme.transitions.duration.short,
      }),
    },
  }),
  icon: css({
    color,
    padding: theme.spacing(1),
    background: colorManipulator.alpha(color, 0.25),
    borderRadius: theme.shape.radius.default,
  }),
  cta: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    color: theme.flags.visualDesignRefresh ? theme.colors.accent.main : theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
