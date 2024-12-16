import { css } from '@emotion/css';
import { groupBy } from 'lodash';
import { PropsWithChildren, ReactNode, useMemo, useRef } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, Icon, IconButton, LinkButton, Menu, Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import {
  DataSourceRuleGroupIdentifier,
  ExternalRulesSourceIdentifier,
  GrafanaRulesSourceSymbol,
  RuleGroup,
  RulesSourceIdentifier,
} from 'app/types/unified-alerting';
import { GrafanaPromRuleGroupDTO, PromRuleType, RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { groupRulesByFileName } from '../api/prometheus';
import { Spacer } from '../components/Spacer';
import { WithReturnButton } from '../components/WithReturnButton';
import { getExternalRulesSources, GrafanaRulesSource } from '../utils/datasource';
import { hashRule } from '../utils/rule-id';

import { AlertRuleLoader } from './AlertRuleLoader';
import { AlertRuleListItem, RecordingRuleListItem } from './components/AlertRuleListItem';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { DataSourceIcon } from './components/Namespace';
import { LoadingIndicator } from './components/RuleGroup';
import { useRuleGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { usePaginatedPrometheusGroups } from './hooks/usePaginatedPrometheusRuleNamespaces';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const GROUP_PAGE_SIZE = 40;

export function GroupedView() {
  const externalRuleSources = useMemo(() => getExternalRulesSources(), []);

  return (
    <Stack direction="column" gap={1} role="list">
      <GrafanaDataSourceLoader />
      {externalRuleSources.map((ruleSource) => {
        return <DataSourceLoader key={ruleSource.uid} rulesSourceIdentifier={ruleSource} />;
      })}
    </Stack>
  );
}

interface DataSourceLoaderProps {
  rulesSourceIdentifier: ExternalRulesSourceIdentifier;
}

export function GrafanaDataSourceLoader() {
  return <PaginatedGrafanaLoader />;
}

export function DataSourceLoader({ rulesSourceIdentifier }: DataSourceLoaderProps) {
  const { data: dataSourceInfo, isLoading } = useDiscoverDsFeaturesQuery({ uid: rulesSourceIdentifier.uid });

  const { uid, name } = rulesSourceIdentifier;

  if (isLoading) {
    return <DataSourceSection loader={<Skeleton width={250} height={16} />} uid={uid} name={name} />;
  }

  // 2. grab prometheus rule groups with max_groups if supported
  if (dataSourceInfo) {
    return (
      <PaginatedDataSourceLoader
        key={rulesSourceIdentifier.uid}
        rulesSourceIdentifier={rulesSourceIdentifier}
        application={dataSourceInfo.application}
      />
    );
  }

  return null;
}

function PaginatedGrafanaLoader() {
  const { grafanaGroupsGenerator } = useRuleGroupsGenerator();

  const groupsGenerator = useRef(grafanaGroupsGenerator(GROUP_PAGE_SIZE));

  const {
    page: groupsPage,
    nextPage,
    previousPage,
    canMoveForward,
    canMoveBackward,
    isLoading,
  } = usePaginatedPrometheusGroups(groupsGenerator.current, GROUP_PAGE_SIZE);

  const groupsByFolder = groupBy(groupsPage, 'folderUid');

  return (
    <DataSourceSection name="Grafana" application="grafana" uid={GrafanaRulesSourceSymbol} isLoading={isLoading}>
      <Stack direction="column" gap={1}>
        {Object.entries(groupsByFolder).map(([folderUid, groups]) => (
          <ListSection
            key={folderUid}
            title={
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="folder" />{' '}
                <Text variant="body" element="h3">
                  {groups[0].file}
                </Text>
              </Stack>
            }
          >
            {groups.map((group) => (
              <GrafanaRuleGroupListItem
                key={`grafana-ns-${folderUid}-${group.name}`}
                group={group}
                namespaceName={groups[0].file}
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

// TODO Try to use a better rules source identifier
interface PaginatedDataSourceLoaderProps extends Required<Pick<DataSourceSectionProps, 'application'>> {
  rulesSourceIdentifier: ExternalRulesSourceIdentifier;
}

function PaginatedDataSourceLoader({ rulesSourceIdentifier, application }: PaginatedDataSourceLoaderProps) {
  const { uid, name } = rulesSourceIdentifier;
  const { prometheusGroupsGenerator } = useRuleGroupsGenerator();

  const groupsGenerator = useRef(prometheusGroupsGenerator(rulesSourceIdentifier, GROUP_PAGE_SIZE));

  const {
    page: groupsPage,
    nextPage,
    previousPage,
    canMoveForward,
    canMoveBackward,
    isLoading,
  } = usePaginatedPrometheusGroups(groupsGenerator.current, GROUP_PAGE_SIZE);

  const ruleNamespaces = useMemo(() => groupRulesByFileName(groupsPage, name), [groupsPage, name]);

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
                key={`${String(rulesSourceIdentifier.uid)}-${namespace.name}-${group.name}`}
                group={group}
                rulesSourceIdentifier={rulesSourceIdentifier}
                namespaceName={namespace.name}
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

interface GrafanaRuleGroupListItemProps {
  group: GrafanaPromRuleGroupDTO;
  namespaceName: string;
}

function GrafanaRuleGroupListItem({ group, namespaceName }: GrafanaRuleGroupListItemProps) {
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
      {group.rules.map((rule) => {
        switch (rule.type) {
          case PromRuleType.Alerting:
            return (
              <AlertRuleListItem
                name={rule.name}
                rulesSource={GrafanaRulesSource}
                application="grafana"
                group={group.name}
                namespace={namespaceName}
                href={''}
                summary={rule.annotations?.summary}
                state={rule.state}
                health={rule.health}
                error={rule.lastError}
                labels={rule.labels}
                isProvisioned={undefined}
                instancesCount={rule.alerts?.length}
                // actions={<></>}
                // origin={originMeta}
              />
            );
          case PromRuleType.Recording:
            return (
              <RecordingRuleListItem
                name={rule.name}
                rulesSource={GrafanaRulesSource}
                application="grafana"
                group={group.name}
                namespace={namespaceName}
                href={''}
                health={rule.health}
                error={rule.lastError}
                labels={rule.labels}
                isProvisioned={undefined}
                // actions={actions}
                // origin={originMeta}
              />
            );
          default:
            return <div>Unknown rule type</div>;
        }
      })}
    </ListGroup>
  );
}

interface RuleGroupListItemProps {
  group: RuleGroup;
  rulesSourceIdentifier: ExternalRulesSourceIdentifier;
  namespaceName: string;
}

function RuleGroupListItem({ rulesSourceIdentifier, group, namespaceName }: RuleGroupListItemProps) {
  const rulesWithGroupId = useMemo(() => {
    return group.rules.map((rule) => {
      const groupIdentifier: DataSourceRuleGroupIdentifier = {
        rulesSource: rulesSourceIdentifier,
        namespace: { name: namespaceName },
        groupName: group.name,
        groupOrigin: 'datasource',
      };
      return { rule, groupIdentifier };
    });
  }, [group, namespaceName, rulesSourceIdentifier]);

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
  uid: RulesSourceIdentifier['uid'];
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
    <section aria-labelledby={`datasource-${String(uid)}-heading`} role="listitem">
      <Stack direction="column" gap={1}>
        <Stack direction="column" gap={0}>
          {isLoading && <LoadingIndicator datasourceUid={String(uid)} />}
          <div className={styles.dataSourceSectionTitle}>
            {loader ?? (
              <Stack alignItems="center">
                {application && <DataSourceIcon application={application} />}
                <Text variant="body" weight="bold" element="h2" id={`datasource-${String(uid)}-heading`}>
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
                    <LinkButton variant="secondary" size="sm" href={`/connections/datasources/edit/${String(uid)}`}>
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
