import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';

import { ctaClicked } from '../analytics/main';

import type { RecommendationItem } from './types';

interface RecommendationPillProps {
  recommendation: RecommendationItem;
}

export function RecommendationPill({ recommendation }: RecommendationPillProps) {
  const styles = useStyles2(getStyles, recommendation.color);

  return (
    <LinkButton
      variant="secondary"
      size="sm"
      fill="solid"
      icon={recommendation.icon}
      href={recommendation.href}
      onClick={() =>
        ctaClicked({
          surface: 'recommendations',
          action: recommendation.cta ?? 'enable',
          placement: 'pill',
          recommendation_id: recommendation.id,
        })
      }
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
