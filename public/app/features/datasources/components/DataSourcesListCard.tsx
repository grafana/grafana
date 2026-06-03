import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { dateTimeFormat, type DataSourceSettings, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, Card, LinkButton, Spinner, Stack, Tag, useStyles2 } from '@grafana/ui';

import { ROUTES } from '../../connections/constants';
import { type DatasourceFailureDetails } from '../../connections/hooks/useDatasourceAdvisorChecks';
import { type DataSourceHealth } from '../state/useDataSourceHealth';
import { trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

import { BuildDashboardButton } from './BuildDashboardButton';
import { DataSourceFailureBadge } from './DataSourceFailureBadge';

export interface Props {
  dataSource: DataSourceSettings;
  hasWriteRights: boolean;
  hasExploreRights: boolean;
  failure?: DatasourceFailureDetails;
  /** When provided, renders a live health-check indicator (checkmark when passing). */
  health?: DataSourceHealth;
}

function HealthBadge({ health }: { health: DataSourceHealth }) {
  if (health.status === 'loading') {
    return <Spinner size="sm" inline />;
  }
  if (health.status === 'healthy') {
    return <Badge icon="check" color="green" text={t('datasources.data-sources-list-card.healthy', 'Healthy')} />;
  }
  return (
    <Badge
      icon="exclamation-triangle"
      color="red"
      text={t('datasources.data-sources-list-card.unhealthy', 'Unhealthy')}
      tooltip={health.message}
    />
  );
}

export function DataSourcesListCard({ dataSource, hasWriteRights, hasExploreRights, failure, health }: Props) {
  const dsLink = config.appSubUrl + ROUTES.DataSourcesEdit.replace(/:uid/gi, dataSource.uid);
  const styles = useStyles2(getStyles);

  // The list DTO always serializes `created`; treat the Go zero time as "no date".
  const hasCreated = Boolean(dataSource.created) && !dataSource.created!.startsWith('0001-01-01');

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
          hasCreated &&
            t('datasources.data-sources-list-card.created', 'Created {{date}}', {
              date: dateTimeFormat(dataSource.created!, { format: 'YYYY-MM-DD' }),
            }),
          dataSource.isDefault && <Tag key="default-tag" name={'default'} colorIndex={1} />,
          health && <HealthBadge key="health-badge" health={health} />,
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
