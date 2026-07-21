import { reportInteraction } from '@grafana/runtime';
import { Card, Icon, Link, Stack, Text, useStyles2 } from '@grafana/ui';
import { type LocationInfo } from 'app/features/search/service/types';
import { StarToolbarButton } from 'app/features/stars/StarToolbarButton';

import { type Dashboard } from './DashList';
import { ListRow } from './ListRow';
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
  // Row density for list mode. 'compact' gives denser rows for the redesigned homepage
  density?: 'default' | 'compact';
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
  density = 'default',
}: Props) {
  const css = useStyles2(getStyles);
  const isCompact = density === 'compact';

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
        <ListRow
          isCompact={isCompact}
          title={dashboard.name}
          subtitle={showFolderNames && locationInfo ? locationInfo.name : undefined}
          href={url}
          onClick={onCardLinkClick}
          trailing={
            <StarToolbarButton
              title={dashboard.name}
              group="dashboard.grafana.app"
              kind="Dashboard"
              id={dashboard.uid}
              onStarChange={onStarChange}
            />
          }
        />
      ) : (
        <Card noMargin className={css.dashlistCardContainer}>
          <Stack justifyContent="space-between" alignItems="start" height="100%">
            <Link
              className={css.dashlistCard}
              href={url}
              aria-label={dashboard.name}
              title={dashboard.name}
              onClick={onCardLinkClick}
            >
              <div className={css.dashlistCardLink}>{dashboard.name}</div>

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
            </Link>

            <StarToolbarButton
              title={dashboard.name}
              group="dashboard.grafana.app"
              kind="Dashboard"
              id={dashboard.uid}
              onStarChange={onStarChange}
            />
          </Stack>
        </Card>
      )}
    </>
  );
}
