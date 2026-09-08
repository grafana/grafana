import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { ctaClicked } from '../analytics/main';
import { LearnMoreLink } from '../solutions/LearnMoreLink';

import { isExternal, type RecommendationItem } from './types';

interface RecommendationCardProps {
  recommendation: RecommendationItem;
  startingState: string;
  /** Solution view active when the card was clicked; absent when no solution is selected. */
  solution?: string;
}

export function RecommendationCard({ recommendation, startingState, solution }: RecommendationCardProps) {
  const styles = useStyles2(getStyles, recommendation.color);
  const action = recommendation.cta ?? 'enable';
  const external = isExternal(recommendation.href);
  const trackClick = () =>
    ctaClicked({
      surface: 'recommendations',
      action,
      placement: 'card',
      recommendation_id: recommendation.id,
      starting_state: startingState,
      solution,
    });

  return (
    <Stack direction="column" justifyContent="space-between" gap={2} flex={1}>
      <Stack direction="column" gap={2}>
        <Text element="h3" variant="h3" color="primary">
          {recommendation.title}
        </Text>

        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name={recommendation.icon} className={styles.icon} />
          <Text variant="body" color="secondary">
            {recommendation.context}
          </Text>
        </Stack>

        <Text variant="body">{recommendation.description}</Text>
      </Stack>

      <Stack direction="row" alignItems="center" gap={1}>
        {action === 'learn_more' ? (
          <LearnMoreLink href={recommendation.href} external={external} onClick={trackClick} />
        ) : (
          <LinkButton
            variant="primary"
            size="md"
            fill="solid"
            icon="arrow-right"
            iconPlacement="right"
            href={recommendation.href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            onClick={trackClick}
          >
            {recommendation.action}
          </LinkButton>
        )}
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2, color: RecommendationItem['color']) => ({
  icon: css({
    color: typeof color === 'function' ? color(theme) : color,
  }),
});
