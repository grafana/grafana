import { groupBy, isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Icon, LinkButton, Stack, Text } from '@grafana/ui';
import { DataSourceRuleGroupIdentifier, DataSourceRulesSourceIdentifier, RuleGroup } from 'app/types/unified-alerting';
import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { AlertingAction, useAlertingAbility } from '../hooks/useAbilities';
import { groups } from '../utils/navigation';

import { DataSourceGroupLoader } from './DataSourceGroupLoader';
import { DataSourceSection, DataSourceSectionProps } from './components/DataSourceSection';
import { GroupIntervalIndicator } from './components/GroupIntervalMetadata';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { LoadMoreButton } from './components/LoadMoreButton';
import { NoRulesFound } from './components/NoRulesFound';
import { getDatasourceFilter } from './hooks/datasourceFilter';
import { toIndividualRuleGroups, usePrometheusGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { useDataSourceLoadingReporter } from './hooks/useDataSourceLoadingReporter';
import { DataSourceLoadState } from './hooks/useDataSourceLoadingStates';
import { useLazyLoadPrometheusGroups } from './hooks/useLazyLoadPrometheusGroups';
import { FRONTED_GROUPED_PAGE_SIZE, getApiGroupPageSize } from './paginationLimits';

interface LoaderProps extends Required<Pick<DataSourceSectionProps, 'application'>> {
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
  groupFilter?: string;
  namespaceFilter?: string;
  onLoadingStateChange?: (uid: string, state: DataSourceLoadState) => void;
}

export function PaginatedDataSourceLoader({
  rulesSourceIdentifier,
  application,
  groupFilter,
  namespaceFilter,
  onLoadingStateChange,
}: LoaderProps) {
  const key = `${rulesSourceIdentifier.uid}-${groupFilter}-${namespaceFilter}`;

  // Key is crucial. It resets the generator when filters change.
  return (
    <PaginatedGroupsLoader
      key={key}
      rulesSourceIdentifier={rulesSourceIdentifier}
      application={application}
      groupFilter={groupFilter}
      namespaceFilter={namespaceFilter}
      onLoadingStateChange={onLoadingStateChange}
    />
  );
}

function PaginatedGroupsLoader({
  rulesSourceIdentifier,
  application,
  groupFilter,
  namespaceFilter,
  onLoadingStateChange,
}: LoaderProps) {
  // If there are filters, we don't want to populate the cache to avoid performance issues
  // Filtering may trigger multiple HTTP requests, which would populate the cache with a lot of groups hurting performance
  const hasFilters = Boolean(groupFilter || namespaceFilter);

  const { uid, name } = rulesSourceIdentifier;
  const prometheusGroupsGenerator = usePrometheusGroupsGenerator();

  // If there are no filters we can match one frontend page to one API page.
  // However, if there are filters, we need to fetch more groups from the API to populate one frontend page
  const apiGroupPageSize = getApiGroupPageSize(hasFilters);

  const groupsGenerator = useRef(
    toIndividualRuleGroups(prometheusGroupsGenerator(rulesSourceIdentifier, apiGroupPageSize))
  );

  useEffect(() => {
    const currentGenerator = groupsGenerator.current;
    return () => {
      currentGenerator.return();
    };
  }, []);

  const filterFn = useMemo(() => {
    const { groupMatches } = getDatasourceFilter({
      namespace: namespaceFilter,
      groupName: groupFilter,
      freeFormWords: [],
      ruleName: '',
      labels: [],
      ruleType: undefined,
      ruleState: undefined,
      ruleHealth: undefined,
      dashboardUid: undefined,
      dataSourceNames: [],
      plugins: undefined,
      contactPoint: undefined,
      ruleSource: undefined,
    });
    return (group: PromRuleGroupDTO) => groupMatches(group);
  }, [namespaceFilter, groupFilter]);

  const { isLoading, groups, hasMoreGroups, fetchMoreGroups, error } = useLazyLoadPrometheusGroups(
    groupsGenerator.current,
    FRONTED_GROUPED_PAGE_SIZE,
    filterFn
  );

  // Report state changes to parent using custom hook
  useDataSourceLoadingReporter(uid, { isLoading, rulesCount: groups.length, error }, onLoadingStateChange);

  const hasNoRules = isEmpty(groups) && !isLoading;
  const groupsByNamespace = useMemo(() => groupBy(groups, 'file'), [groups]);

  // if we are loading and there are filters configured – we shouldn't show any data source headers
  // until we have at least one result. This will provide a cleaner UI whent he user wants to find a specific folder or group.
  // We will have another UI element indicating that we are still searching in other datasources.
  if (hasFilters && isEmpty(groups)) {
    return null;
  }

  return (
    <DataSourceSection name={name} application={application} uid={uid} isLoading={isLoading} error={error}>
      <Stack direction="column" gap={0}>
        {Object.entries(groupsByNamespace).map(([namespace, groups]) => (
          <ListSection
            key={namespace}
            title={
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="folder" />{' '}
                <Text variant="body" element="h3">
                  {namespace}
                </Text>
              </Stack>
            }
          >
            {groups.map((group) => (
              <RuleGroupListItem
                key={`${rulesSourceIdentifier.uid}-${namespace}-${group.name}`}
                group={group}
                rulesSourceIdentifier={rulesSourceIdentifier}
                namespaceName={namespace}
              />
            ))}
          </ListSection>
        ))}
        {hasMoreGroups && !hasNoRules && (
          // this div will make the button not stretch
          <div>
            <LoadMoreButton loading={isLoading} onClick={fetchMoreGroups} />
          </div>
        )}
        {hasNoRules && <NoRulesFound />}
      </Stack>
    </DataSourceSection>
  );
}

interface RuleGroupListItemProps {
  group: RuleGroup;
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
  namespaceName: string;
}

function RuleGroupListItem({ rulesSourceIdentifier, group, namespaceName }: RuleGroupListItemProps) {
  const groupIdentifier: DataSourceRuleGroupIdentifier = useMemo(
    () => ({
      rulesSource: rulesSourceIdentifier,
      namespace: { name: namespaceName },
      groupName: group.name,
      groupOrigin: 'datasource',
    }),
    [rulesSourceIdentifier, namespaceName, group.name]
  );

  return (
    <ListGroup
      key={group.name}
      name={group.name}
      href={groups.detailsPageLink(rulesSourceIdentifier.uid, namespaceName, group.name)}
      isOpen={false}
      metaRight={<GroupIntervalIndicator seconds={group.interval} />}
      actions={
        <DataSourceGroupActions
          dsUid={rulesSourceIdentifier.uid}
          namespaceName={namespaceName}
          groupName={group.name}
        />
      }
    >
      <DataSourceGroupLoader groupIdentifier={groupIdentifier} expectedRulesCount={group.rules.length} />
    </ListGroup>
  );
}

interface DataSourceGroupActionsProps {
  dsUid: string;
  namespaceName: string;
  groupName: string;
}

function DataSourceGroupActions({ dsUid, namespaceName, groupName }: DataSourceGroupActionsProps) {
  const [editRuleSupported, editRuleAllowed] = useAlertingAbility(AlertingAction.UpdateExternalAlertRule);
  const canEdit = editRuleSupported && editRuleAllowed;

  if (!canEdit) {
    return null;
  }

  const editLink = groups.editPageLink(dsUid, namespaceName, groupName);

  return (
    <LinkButton
      title={t('alerting.rule-list.edit-group', 'Edit')}
      size="sm"
      variant="secondary"
      fill="text"
      href={editLink}
    >
      <Trans i18nKey="common.edit">Edit</Trans>
    </LinkButton>
  );
}
