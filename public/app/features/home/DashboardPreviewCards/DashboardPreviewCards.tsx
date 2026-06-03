import { Trans } from '@grafana/i18n';
import { Grid, Stack, Text } from '@grafana/ui';

import { DashboardPreviewCard } from './DashboardPreviewCard';
import { dashboardPreviewCards } from './dashboardPreviewData';

export function DashboardPreviewCards() {
  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4">
        <Trans i18nKey="home.dashboard-preview-cards.heading">Explore Dashboards</Trans>
      </Text>
      <Grid minColumnWidth={34} gap={2}>
        {dashboardPreviewCards.map((card) => (
          <DashboardPreviewCard key={card.id} card={card} />
        ))}
      </Grid>
    </Stack>
  );
}
