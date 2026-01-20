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
  source: string; // for rudderstack analytics to track which page DashListItem click from
  order?: number; // for rudderstack analytics to track position in cards
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
  source,
}: Props) {
  const css = useStyles2(getStyles);

  const onCardLinkClick = () => {
    reportInteraction('grafana_browse_dashboards_page_click_list_item', {
      itemKind: dashboard.kind,
      source,
      uid: dashboard.uid,
      cardOrder: order,
    });
  };

  return (
    <>
      {layoutMode === 'list' ? (
        <div className={css.dashlistLink}>
          <Link href={url}>
            <Text element="p">{dashboard.name}</Text>
            {showFolderNames && locationInfo && (
              <Text color="secondary" variant="bodySmall" element="p">
                {locationInfo?.name}
              </Text>
            )}
          </Link>
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
