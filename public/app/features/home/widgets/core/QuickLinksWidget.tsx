import { t } from '@grafana/i18n';
import { Stack, Text, TextLink } from '@grafana/ui';

import { HomeSection } from '../../HomeSection';

/** Core widget: static links to common areas of Grafana. Pure navigation, no data fetch. */
export function QuickLinksWidget() {
  return (
    <HomeSection>
      <Stack direction="column" gap={2}>
        <Text element="h2" variant="h4">
          {t('home.widgets.quick-links.title', 'Quick links')}
        </Text>
        <Stack direction="column" gap={1}>
          <TextLink href={'/explore'} inline={false}>
            {t('home.widgets.quick-links.explore', 'Explore')}
          </TextLink>
          <TextLink href={'/dashboards'} inline={false}>
            {t('home.widgets.quick-links.dashboards', 'Dashboards')}
          </TextLink>
          <TextLink href={'/connections'} inline={false}>
            {t('home.widgets.quick-links.connections', 'Connections')}
          </TextLink>
          <TextLink href={'/alerting'} inline={false}>
            {t('home.widgets.quick-links.alerting', 'Alerting')}
          </TextLink>
        </Stack>
      </Stack>
    </HomeSection>
  );
}
