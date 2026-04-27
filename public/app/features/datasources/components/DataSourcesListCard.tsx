import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { DataSourceSettings } from '@grafana/data/types';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Card, LinkButton, Stack, Tag } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { ROUTES } from '../../connections/constants';
import { type DatasourceFailureDetails } from '../../connections/hooks/useDatasourceAdvisorChecks';
import { trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

import { BuildDashboardButton } from './BuildDashboardButton';
import { DataSourceFailureBadge } from './DataSourceFailureBadge';

export interface Props {
  dataSource: DataSourceSettings;
  hasWriteRights: boolean;
  hasExploreRights: boolean;
  failure?: DatasourceFailureDetails;
}

export function DataSourcesListCard({ dataSource, hasWriteRights, hasExploreRights, failure }: Props) {
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
          failure?.severity && (
            <DataSourceFailureBadge key="unhealthy-badge" severity={failure.severity} message={failure.message} />
          ),
        ]}
      </Card.Meta>
      <Card.Tags>
        {/* Build Dashboard */}
        <BuildDashboardButton dataSource={dataSource} size="md" fill="outline" context="datasource_list" />

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
  };
};
