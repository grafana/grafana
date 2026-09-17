import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';

import { ctaClicked } from '../analytics/main';

import { isExternal, type RecommendationItem } from './types';

interface RecommendationPillProps {
  recommendation: RecommendationItem;
  startingState: string;
  /** Solution view active when the pill was clicked; absent when no solution is selected. */
  solution?: string;
}

export function RecommendationPill({ recommendation, startingState, solution }: RecommendationPillProps) {
  const styles = useStyles2(getStyles, recommendation.color);
  const external = isExternal(recommendation.href);
  const trackClick = () =>
    ctaClicked({
      surface: 'recommendations',
      action: recommendation.cta ?? 'enable',
      placement: 'pill',
      recommendation_id: recommendation.id,
      starting_state: startingState,
      solution,
    });

  return (
    <LinkButton
      variant="secondary"
      size="sm"
      fill="solid"
      icon={recommendation.icon}
      href={recommendation.href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onClick={trackClick}
      className={styles.pill}
    >
      {recommendation.action}
    </LinkButton>
  );
}

const getStyles = (theme: GrafanaTheme2, color: RecommendationItem['color']) => ({
  pill: css({
    borderRadius: theme.shape.radius.pill,
    border: `1px solid ${theme.colors.border.medium}`,

    '& > svg': {
      color: typeof color === 'function' ? color(theme) : color,
    },
  }),
});
