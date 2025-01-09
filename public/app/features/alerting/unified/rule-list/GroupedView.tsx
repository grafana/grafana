import { css } from '@emotion/css';
import { PropsWithChildren, ReactNode, useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, Icon, IconButton, LinkButton, Menu, Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { DataSourceNamespaceIdentifier, DataSourceRuleGroupIdentifier, RuleGroup } from 'app/types/unified-alerting';
import { RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { Spacer } from '../components/Spacer';
import { WithReturnButton } from '../components/WithReturnButton';
import { getDatasourceAPIUid, getExternalRulesSources } from '../utils/datasource';
import { hashRule } from '../utils/rule-id';

import { AlertRuleLoader } from './AlertRuleLoader';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { DataSourceIcon } from './components/Namespace';
import { LoadingIndicator } from './components/RuleGroup';
import { usePaginatedPrometheusRuleNamespaces } from './hooks/usePaginatedPrometheusRuleNamespaces';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const GROUP_PAGE_SIZE = 40;

export function GroupedView() {
  const externalRuleSources = useMemo(() => getExternalRulesSources(), []);

  return (
    <Stack direction="column" gap={1} role="list">
      <GrafanaDataSourceLoader />
      {externalRuleSources.map((ruleSource) => {
        return <DataSourceLoader key={ruleSource.uid} uid={ruleSource.uid} name={ruleSource.name} />;
      })}
    </Stack>
  );
}

interface DataSourceLoaderProps {
  name: string;
  uid: string;
}

export function GrafanaDataSourceLoader() {
  return <DataSourceSection name="Grafana" application="grafana" uid="grafana" isLoading={true} />;
}

export function DataSourceLoader({ uid, name }: DataSourceLoaderProps) {
  const { data: dataSourceInfo, isLoading } = useDiscoverDsFeaturesQuery({ uid });

  if (isLoading) {
    return <DataSourceSection loader={<Skeleton width={250} height={16} />} uid={uid} name={name} />;
  }

  // 2. grab prometheus rule groups with max_groups if supported
  if (dataSourceInfo) {
    return (
      <PaginatedDataSourceLoader
        ruleSourceName={dataSourceInfo.name}
        uid={uid}
        name={name}
        application={dataSourceInfo.application}
      />
    );
  }

  return null;
}

// TODO Try to use a better rules source identifier
interface PaginatedDataSourceLoaderProps
  extends Required<Pick<DataSourceSectionProps, 'application' | 'uid' | 'name'>> {
  ruleSourceName: string;
}

function PaginatedDataSourceLoader({ ruleSourceName, name, uid, application }: PaginatedDataSourceLoaderProps) {
  const {
    page: ruleNamespaces,
    nextPage,
    previousPage,
    canMoveForward,
    canMoveBackward,
    isLoading,
  } = usePaginatedPrometheusRuleNamespaces(ruleSourceName, GROUP_PAGE_SIZE);

  return (
    <DataSourceSection name={name} application={application} uid={uid} isLoading={isLoading}>
      <Stack direction="column" gap={1}>
        {ruleNamespaces.map((namespace) => (
          <ListSection
            key={namespace.name}
            title={
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="folder" />{' '}
                <Text variant="body" element="h3">
                  {namespace.name}
                </Text>
              </Stack>
            }
          >
            {namespace.groups.map((group) => (
              <RuleGroupListItem
                key={`${ruleSourceName}-${namespace.name}-${group.name}`}
                group={group}
                ruleSourceName={ruleSourceName}
                namespaceId={namespace}
              />
            ))}
          </ListSection>
        ))}
        <LazyPagination
          nextPage={nextPage}
          previousPage={previousPage}
          canMoveForward={canMoveForward}
          canMoveBackward={canMoveBackward}
        />
      </Stack>
    </DataSourceSection>
  );
}

interface RuleGroupListItemProps {
  group: RuleGroup;
  ruleSourceName: string;
  namespaceId: DataSourceNamespaceIdentifier;
}

function RuleGroupListItem({ group, ruleSourceName, namespaceId }: RuleGroupListItemProps) {
  const rulesWithGroupId = useMemo(
    () =>
      group.rules.map((rule) => {
        const groupIdentifier: DataSourceRuleGroupIdentifier = {
          rulesSource: { uid: getDatasourceAPIUid(ruleSourceName), name: ruleSourceName },
          namespace: namespaceId,
          groupName: group.name,
          groupOrigin: 'datasource',
        };
        return { rule, groupIdentifier };
      }),
    [group, namespaceId, ruleSourceName]
  );

  return (
    <ListGroup
      key={group.name}
      name={group.name}
      isOpen={false}
      actions={
        <>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item label="Edit" icon="pen" data-testid="edit-group-action" />
                <Menu.Item label="Re-order rules" icon="flip" />
                <Menu.Divider />
                <Menu.Item label="Export" icon="download-alt" />
                <Menu.Item label="Delete" icon="trash-alt" destructive />
              </Menu>
            }
          >
            <IconButton name="ellipsis-h" aria-label="rule group actions" />
          </Dropdown>
        </>
      }
    >
      {rulesWithGroupId.map(({ rule, groupIdentifier }) => (
        <AlertRuleLoader key={hashRule(rule)} rule={rule} groupIdentifier={groupIdentifier} />
      ))}
    </ListGroup>
  );
}

interface DataSourceSectionProps extends PropsWithChildren {
  uid: string;
  name: string;
  loader?: ReactNode;
  application?: RulesSourceApplication;
  isLoading?: boolean;
  description?: ReactNode;
}

const DataSourceSection = ({
  uid,
  name,
  application,
  children,
  loader,
  isLoading = false,
  description = null,
}: DataSourceSectionProps) => {
  const styles = useStyles2(getStyles);

  return (
    <section aria-labelledby={`datasource-${uid}-heading`} role="listitem">
      <Stack direction="column" gap={1}>
        <Stack direction="column" gap={0}>
          {isLoading && <LoadingIndicator datasourceUid={uid} />}
          <div className={styles.dataSourceSectionTitle}>
            {loader ?? (
              <Stack alignItems="center">
                {application && <DataSourceIcon application={application} />}
                <Text variant="body" weight="bold" element="h2" id={`datasource-${uid}-heading`}>
                  {name}
                </Text>
                {description && (
                  <>
                    {'·'}
                    {description}
                  </>
                )}
                <Spacer />
                <WithReturnButton
                  title="alert rules"
                  component={
                    <LinkButton variant="secondary" size="sm" href={`/connections/datasources/edit/${uid}`}>
                      <Trans i18nKey="alerting.rule-list.configure-datasource">Configure</Trans>
                    </LinkButton>
                  }
                />
              </Stack>
            )}
          </div>
        </Stack>
        <div className={styles.itemsWrapper}>{children}</div>
      </Stack>
    </section>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  itemsWrapper: css({
    position: 'relative',
    marginLeft: theme.spacing(1.5),

    '&:before': {
      content: "''",
      position: 'absolute',
      height: '100%',

      marginLeft: `-${theme.spacing(1.5)}`,
      borderLeft: `solid 1px ${theme.colors.border.weak}`,
    },
  }),
  dataSourceSectionTitle: css({
    background: theme.colors.background.secondary,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});

interface LazyPaginationProps {
  canMoveForward: boolean;
  canMoveBackward: boolean;
  nextPage: () => void;
  previousPage: () => void;
}

function LazyPagination({ canMoveForward, canMoveBackward, nextPage, previousPage }: LazyPaginationProps) {
  return (
    <Stack direction="row" gap={1}>
      <Button
        aria-label={`previous page`}
        size="sm"
        variant="secondary"
        onClick={previousPage}
        disabled={!canMoveBackward}
      >
        <Icon name="angle-left" />
      </Button>
      <Button aria-label={`next page`} size="sm" variant="secondary" onClick={nextPage} disabled={!canMoveForward}>
        <Icon name="angle-right" />
      </Button>
    </Stack>
  );
}
