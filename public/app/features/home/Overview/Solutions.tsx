import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { EmptyState, Grid, Stack, Text, useStyles2 } from '@grafana/ui';

import { SOLUTION_IDS } from '../solutions/constants';

import { OverviewSectionHeading, type OverviewSectionHeadingVariant } from './OverviewSectionHeading';
import { AvailableSolutionCard, SolutionCard, SolutionCardSkeleton } from './SolutionCard';
import { groupOverviewCards, type OverviewCard } from './solutionGroups';

interface SolutionsProps {
  emptyMessage: string;
  loading: boolean;
  cards: OverviewCard[];
}

export function Solutions({ emptyMessage, loading, cards }: SolutionsProps) {
  if (loading) {
    return (
      <Grid gap={2} columns={{ xs: 1, md: 2, lg: 3 }}>
        {Array.from({ length: SOLUTION_IDS.length }).map((_, index) => (
          <SolutionCardSkeleton key={index} />
        ))}
      </Grid>
    );
  }

  if (cards.length === 0) {
    return <EmptyState hideImage variant="not-found" message={emptyMessage} />;
  }

  const groups = groupOverviewCards(cards);

  return (
    <Stack direction="column" gap={3}>
      <SolutionGroup
        label={t('home.overview.groups.attention', 'Needs attention')}
        cards={groups.attention}
        variant="warning"
      />
      <SolutionGroup label={t('home.overview.groups.enabled', 'Enabled')} cards={groups.enabled} variant="success" />
      <SolutionGroup
        label={t('home.overview.groups.available', 'Available')}
        cards={groups.available}
        variant="default"
      />
    </Stack>
  );
}

interface SolutionGroupProps {
  label: string;
  cards: OverviewCard[];
  variant: OverviewSectionHeadingVariant;
}

function SolutionGroup({ label, cards, variant }: SolutionGroupProps) {
  const styles = useStyles2(getStyles);

  if (cards.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={1.5}>
      <OverviewSectionHeading variant={variant} count={cards.length}>
        <span className={styles.heading}>
          <Text element="h3" variant="bodySmall" color="secondary">
            {label}
          </Text>
        </span>
      </OverviewSectionHeading>

      <Grid gap={2} columns={{ xs: 1, md: 2, lg: 3 }}>
        {cards.map((card) =>
          card.kind === 'offer' ? (
            <AvailableSolutionCard key={card.solution.id} solution={card.solution} offer={card.offer} />
          ) : (
            <SolutionCard key={card.solution.id} solution={card.solution} needsAttention={card.needsAttention} />
          )
        )}
      </Grid>
    </Stack>
  );
}

const getStyles = () => ({
  heading: css({
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }),
});
