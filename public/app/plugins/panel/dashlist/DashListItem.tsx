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

  const onCardLinkClick = () => {
    reportInteraction('grafana_recently_viewed_dashboards_click_card', {
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
        <Card noMargin className={css.dashlistCardContainer}>
          <div className={css.dashlistCard}>
            <Stack justifyContent="space-between" alignItems="start">
              <Link
                className={css.dashlistCardLink}
                href={url}
                aria-label={dashboard.name}
                title={dashboard.name}
                onClick={onCardLinkClick}
              >
                {dashboard.name}
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
              <Stack alignItems="start" direction="row" gap={0.5}>
                <Icon name="folder" size="sm" className={css.dashlistCardIcon} aria-hidden="true" />
                <div className={css.dashlistCardFolder}>
                  <Text
                    color="secondary"
                    variant="bodySmall"
                    element="p"
                    aria-label={locationInfo?.name}
                    title={locationInfo?.name}
                  >
                    {locationInfo?.name}
                  </Text>
                </div>
              </Stack>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
