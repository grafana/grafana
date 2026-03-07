import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { DataSourceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, Card, LinkButton, Stack, Tag, useStyles2 } from '@grafana/ui';

import { ROUTES } from '../../connections/constants';
import { trackCreateDashboardClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

export interface Props {
  dataSource: DataSourceSettings;
  hasWriteRights: boolean;
  hasExploreRights: boolean;
  isUnhealthy?: boolean;
}

export function DataSourcesListCard({ dataSource, hasWriteRights, hasExploreRights, isUnhealthy }: Props) {
  const dsLink = config.appSubUrl + ROUTES.DataSourcesEdit.replace(/:uid/gi, dataSource.uid);
  const styles = useStyles2(getStyles);

  return (
    <Card noMargin href={hasWriteRights ? dsLink : undefined}>
      <Card.Heading>{dataSource.name}</Card.Heading>
      <Card.Figure>
        <img src={dataSource.typeLogoUrl} alt="" height="40px" width="40px" className={styles.logo} />
      </Card.Figure>
      <Card.Meta>
        {[
          dataSource.typeName,
          dataSource.url,
          dataSource.isDefault && <Tag key="default-tag" name={'default'} colorIndex={1} />,
          isUnhealthy && (
            <Badge
              key="health-badge"
              text={t('datasources.health-badge.unhealthy', 'Unhealthy')}
              color="red"
              icon="exclamation-triangle"
              className={styles.healthBadge}
            />
          ),
        ]}
      </Card.Meta>
      <Card.Tags>
        {/* Build Dashboard */}
        <LinkButton
          icon="apps"
          fill="outline"
          variant="secondary"
          href={`dashboard/new-with-ds/${dataSource.uid}`}
          onClick={() => {
            trackCreateDashboardClicked({
              grafana_version: config.buildInfo.version,
              datasource_uid: dataSource.uid,
              plugin_name: dataSource.typeName,
              path: window.location.pathname,
            });
          }}
        >
          <Trans i18nKey="datasources.data-sources-list-card.build-a-dashboard">Build a dashboard</Trans>
        </LinkButton>

        {/* Explore */}
        {hasExploreRights && (
          <LinkButton
            icon="compass"
            fill="outline"
            variant="secondary"
            className={styles.button}
            href={constructDataSourceExploreUrl(dataSource)}
            onClick={() => {
              trackExploreClicked({
                grafana_version: config.buildInfo.version,
                datasource_uid: dataSource.uid,
                plugin_name: dataSource.typeName,
                path: window.location.pathname,
              });
            }}
          >
            <Trans i18nKey="datasources.data-sources-list-card.explore">Explore</Trans>
          </LinkButton>
        )}
      </Card.Tags>
    </Card>
  );
}

function DataSourcesListCardSkeleton({ hasExploreRights }: Pick<Props, 'hasExploreRights'>) {
  const skeletonStyles = useStyles2(getSkeletonStyles);
  return (
    <Card noMargin>
      <Card.Heading>
        <Skeleton width={140} />
      </Card.Heading>
      <Card.Figure>
        <Skeleton width={40} height={40} containerClassName={skeletonStyles.figure} />
      </Card.Figure>
      <Card.Meta>
        <Skeleton width={120} />
      </Card.Meta>
      <Card.Tags>
        <Stack direction="row" gap={2}>
          <Skeleton height={32} width={179} containerClassName={skeletonStyles.button} />

          {/* Explore */}
          {hasExploreRights && <Skeleton height={32} width={107} containerClassName={skeletonStyles.button} />}
        </Stack>
      </Card.Tags>
    </Card>
  );
}

DataSourcesListCard.Skeleton = DataSourcesListCardSkeleton;

const getSkeletonStyles = () => {
  return {
    button: css({
      lineHeight: 1,
    }),
    figure: css({
      lineHeight: 1,
    }),
  };
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    logo: css({
      objectFit: 'contain',
    }),
    button: css({
      marginLeft: theme.spacing(2),
    }),
    healthBadge: css({
      whiteSpace: 'nowrap',
      marginRight: theme.spacing(1),
    }),
  };
};
