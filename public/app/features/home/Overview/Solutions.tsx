import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { EmptyState, Grid, Stack, Text, useStyles2 } from '@grafana/ui';

import { OverviewSectionHeading, type OverviewSectionHeadingVariant } from './OverviewSectionHeading';
import { AvailableSolutionCard, SolutionCard, SolutionCardSkeleton } from './SolutionCard';
import { groupOverviewCards, type OverviewCard } from './solutionGroups';

export function SolutionGridSkeleton({ count }: { count: number }) {
  return (
    <Grid gap={2} columns={{ xs: 1, md: 2, lg: 3 }}>
      {Array.from({ length: count }).map((_, index) => (
        <SolutionCardSkeleton key={index} />
      ))}
    </Grid>
  );
}

interface SolutionsProps {
  emptyMessage: string;
  cards: OverviewCard[];
  /** Solutions still resolving; each holds a card-sized skeleton below the groups. */
  pendingCount: number;
}

export function Solutions({ emptyMessage, cards, pendingCount }: SolutionsProps) {
  if (cards.length === 0 && pendingCount === 0) {
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
      {pendingCount > 0 && <SolutionGridSkeleton count={pendingCount} />}
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
