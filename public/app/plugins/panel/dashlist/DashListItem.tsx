import { truncate } from 'lodash';

import { reportInteraction } from '@grafana/runtime';
import { Box, Card, Icon, Link, Stack, Text, useStyles2 } from '@grafana/ui';
import { LocationInfo } from 'app/features/search/service/types';
import { StarToolbarButton } from 'app/features/stars/StarToolbarButton';

import { Dashboard } from './DashList';
import { getStyles } from './styles';

interface Props {
  dashboard: Dashboard;
  url: string;
  showFolderNames: boolean;
  locationInfo?: LocationInfo;
  layoutMode: 'list' | 'card';
  order?: number; // for rudderstack analytics to track position in card list
  onStarChange?: (id: string, isStarred: boolean) => void;
}
export function DashListItem({
  dashboard,
  url,
  showFolderNames,
  locationInfo,
  layoutMode,
  order,
  onStarChange,
}: Props) {
  const css = useStyles2(getStyles);
  const shortTitle = truncate(dashboard.name, { length: 40, omission: '…' });

  const onCardLinkClick = () => {
    reportInteraction('grafana_browse_dashboards_page_click_list_item', {
      itemKind: dashboard.kind,
      source: 'browseDashboardsPage_RecentlyViewed',
      uid: dashboard.uid,
      cardOrder: order,
    });
  };

  return (
    <>
      {layoutMode === 'list' ? (
        <div className={css.dashlistLink}>
          <Box flex={1}>
            <Link href={url}>{dashboard.name}</Link>
            {showFolderNames && locationInfo && (
              <Text color="secondary" variant="bodySmall" element="p">
                {locationInfo?.name}
              </Text>
            )}
          </Box>
          <StarToolbarButton
            title={dashboard.name}
            group="dashboard.grafana.app"
            kind="Dashboard"
            id={dashboard.uid}
            onStarChange={onStarChange}
          />
        </div>
      ) : (
        <Card className={css.dashlistCard} noMargin>
          <Stack direction="column" justifyContent="space-between" height="100%">
            <Stack justifyContent="space-between" alignItems="start">
              <Link
                className={css.dashlistCardLink}
                href={url}
                aria-label={dashboard.name}
                title={dashboard.name}
                onClick={onCardLinkClick}
              >
                {shortTitle}
              </Link>
              <StarToolbarButton
                title={dashboard.name}
                group="dashboard.grafana.app"
                kind="Dashboard"
                id={dashboard.uid}
                onStarChange={onStarChange}
              />
            </Stack>

            {showFolderNames && locationInfo && (
              <Stack alignItems="start" direction="row" gap={0.5} height="25%">
                <Icon name="folder" size="sm" className={css.dashlistCardIcon} aria-hidden="true" />
                <Text color="secondary" variant="bodySmall" element="p">
                  {locationInfo?.name}
                </Text>
              </Stack>
            )}
          </Stack>
        </Card>
      )}
    </>
  );
}
