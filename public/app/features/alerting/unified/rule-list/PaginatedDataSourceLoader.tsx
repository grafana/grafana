import { css } from '@emotion/css';
import { groupBy, isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { DataSourceRuleGroupIdentifier, DataSourceRulesSourceIdentifier, RuleGroup } from 'app/types/unified-alerting';

import { groups } from '../utils/navigation';

import { DataSourceGroupLoader } from './DataSourceGroupLoader';
import { DataSourceSection, DataSourceSectionProps } from './components/DataSourceSection';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { LoadMoreButton } from './components/LoadMoreButton';
import { toIndividualRuleGroups, usePrometheusGroupsGenerator } from './hooks/prometheusGroupsGenerator';
import { useLazyLoadPrometheusGroups } from './hooks/useLazyLoadPrometheusGroups';

export const DATA_SOURCE_GROUP_PAGE_SIZE = 40;

interface PaginatedDataSourceLoaderProps extends Required<Pick<DataSourceSectionProps, 'application'>> {
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
}

export function PaginatedDataSourceLoader({ rulesSourceIdentifier, application }: PaginatedDataSourceLoaderProps) {
  const styles = useStyles2(getStyles);

  const { uid, name } = rulesSourceIdentifier;
  const prometheusGroupsGenerator = usePrometheusGroupsGenerator({ populateCache: true });

  const groupsGenerator = useRef(
    toIndividualRuleGroups(prometheusGroupsGenerator(rulesSourceIdentifier, DATA_SOURCE_GROUP_PAGE_SIZE))
  );

  useEffect(() => {
    const currentGenerator = groupsGenerator.current;
    return () => {
      currentGenerator.return();
    };
  }, [groupsGenerator]);

  const { isLoading, groups, hasMoreGroups, fetchMoreGroups } = useLazyLoadPrometheusGroups(
    groupsGenerator.current,
    DATA_SOURCE_GROUP_PAGE_SIZE
  );

  const hasNoRules = isEmpty(groups) && !isLoading;
  const groupsByNamespace = useMemo(() => groupBy(groups, 'file'), [groups]);

  return (
    <DataSourceSection name={name} application={application} uid={uid} isLoading={isLoading}>
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
        {hasMoreGroups && (
          // this div will make the button not stretch
          <div>
            <LoadMoreButton onClick={fetchMoreGroups} />
          </div>
        )}
        {hasNoRules && (
          <div className={styles.noRules}>
            <Text color="secondary">
              <Trans i18nKey="alerting.rule-list.empty-data-source">No rules found</Trans>
            </Text>
          </div>
        )}
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
    >
      <DataSourceGroupLoader groupIdentifier={groupIdentifier} expectedRulesCount={group.rules.length} />
    </ListGroup>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  noRules: css({
    margin: theme.spacing(1.5, 0, 0.5, 4),
  }),
});
