import { css } from '@emotion/css';
import { PropsWithChildren, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  Dropdown,
  Icon,
  IconButton,
  LinkButton,
  Menu,
  Stack,
  Text,
  useStyles2,
  withErrorBoundary,
} from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { Rule, RuleGroupIdentifier, RuleIdentifier } from 'app/types/unified-alerting';
import { PromRuleGroupDTO, RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { groupRulesByFileName } from '../api/prometheus';
import { prometheusApi } from '../api/prometheusApi';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { Spacer } from '../components/Spacer';
import { WithReturnButton } from '../components/WithReturnButton';
import RulesFilter from '../components/rules/Filter/RulesFilter';
import { useRulesFilter } from '../hooks/useFilteredRules';
import { RulesFilter as RulesFilterState } from '../search/rulesSearchParser';
import { getAllRulesSources, getDatasourceAPIUid, isGrafanaRulesSource } from '../utils/datasource';
import { equal, fromRule, fromRulerRule, hashRule, stringifyIdentifier } from '../utils/rule-id';
import { getRulePluginOrigin, isAlertingRule, isRecordingRule } from '../utils/rules';
import { createRelativeUrl } from '../utils/url';

import { AlertRuleListItem, RecordingRuleListItem, UnknownRuleListItem } from './components/AlertRuleListItem';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';
import { DataSourceIcon } from './components/Namespace';
import { ActionsLoader, RuleActionsButtons } from './components/RuleActionsButtons.V2';
import { LoadingIndicator } from './components/RuleGroup';

const { useGetRuleGroupForNamespaceQuery } = alertRuleApi;
const { useLazyGroupsQuery } = prometheusApi;

const RuleList = withErrorBoundary(
  () => {
    const ruleSources = getAllRulesSources();

    return (
      // We don't want to show the Loading... indicator for the whole page.
      // We show separate indicators for Grafana-managed and Cloud rules
      <AlertingPageWrapper navId="alert-list" isLoading={false} actions={null}>
        <RulesFilter onClear={() => {}} />
        <Stack direction="column" gap={1}>
          {ruleSources.map((ruleSource) => {
            if (isGrafanaRulesSource(ruleSource)) {
              return <GrafanaDataSourceLoader key={ruleSource} />;
            } else {
              return <DataSourceLoader key={ruleSource.uid} uid={ruleSource.uid} name={ruleSource.name} />;
            }
          })}
        </Stack>
      </AlertingPageWrapper>
    );
  },
  { style: 'page' }
);

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

interface DataSourceLoaderProps {
  name: string;
  uid: string;
}

const GrafanaDataSourceLoader = () => {
  return <DataSourceSection name="Grafana" application="grafana" isLoading={true}></DataSourceSection>;
};

const DataSourceLoader = ({ uid, name }: DataSourceLoaderProps) => {
  const { data: dataSourceInfo, isLoading } = useDiscoverDsFeaturesQuery({ uid });

  if (isLoading) {
    return <DataSourceSection loader={<Skeleton width={250} height={16} />} />;
  }

  // 2. grab prometheus rule groups with max_groups if supported
  if (dataSourceInfo) {
    const rulerEnabled = Boolean(dataSourceInfo.rulerConfig);

    return (
      <PaginatedDataSourceLoader
        ruleSourceName={dataSourceInfo.name}
        rulerEnabled={rulerEnabled}
        uid={uid}
        name={name}
        application={dataSourceInfo.application}
      />
    );
  }

  return null;
};

interface PaginatedDataSourceLoaderProps extends Pick<DataSourceSectionProps, 'application' | 'uid' | 'name'> {
  ruleSourceName: string;
  rulerEnabled?: boolean;
}

function PaginatedDataSourceLoader({
  ruleSourceName,
  rulerEnabled = false,
  name,
  uid,
  application,
}: PaginatedDataSourceLoaderProps) {
  const { filterState } = useRulesFilter();

  const {
    page: ruleNamespaces,
    nextPage,
    previousPage,
    hasNextPage,
    currentPage,
    isLoading,
  } = usePaginatedPrometheusRuleNamespaces(ruleSourceName, 10, filterState);

  return (
    <DataSourceSection name={name} application={application} uid={uid} isLoading={isLoading}>
      <Stack direction="column" gap={1}>
        {ruleNamespaces.map((namespace) => (
          <ListSection
            key={namespace.name}
            title={
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="folder" /> {namespace.name}
              </Stack>
            }
          >
            {namespace.groups.map((group) => (
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
                  const groupIdentifier: RuleGroupIdentifier = {
                    dataSourceName: ruleSourceName,
                    groupName: group.name,
                    namespaceName: namespace.name,
                  };

                  return (
                    <AlertRuleLoader
                      key={hashRule(rule)}
                      rule={rule}
                      groupIdentifier={groupIdentifier}
                      rulerEnabled={rulerEnabled}
                    />
                  );
                })}
              </ListGroup>
            ))}
          </ListSection>
        ))}
        {!isLoading && (
          <LazyPagination
            hasNextPage={hasNextPage}
            currentPage={currentPage}
            nextPage={nextPage}
            previousPage={previousPage}
          />
        )}
      </Stack>
    </DataSourceSection>
  );
}

function usePaginatedPrometheusRuleNamespaces(ruleSourceName: string, pageSize: number, filterState: RulesFilterState) {
  const [fetchGroups, { isLoading }] = useLazyGroupsQuery();
  const [currentPage, setCurrentPage] = useState(1);
  const [groups, setGroups] = useState<PromRuleGroupDTO[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);

  const getGroups = async function* () {
    const ruleSourceUid = getDatasourceAPIUid(ruleSourceName);

    const response = await fetchGroups({
      ruleSource: { uid: ruleSourceUid },
      maxGroups: 5,
    });

    if (response.data?.data) {
      yield* response.data.data.groups;
    }

    let lastToken: string | undefined = undefined;
    if (response.data?.data?.nextToken) {
      lastToken = response.data.data.nextToken;
    }

    while (lastToken) {
      const response = await fetchGroups({
        ruleSource: { uid: ruleSourceUid },
        nextToken: lastToken,
        maxGroups: 5,
      });

      if (response.data?.data) {
        yield* response.data.data.groups;
      }

      lastToken = response.data?.data?.nextToken;
    }
  };

  const groupsGenerator = useRef<AsyncGenerator<PromRuleGroupDTO, void, unknown>>(getGroups());

  const fetchMoreGroups = useCallback(async (groupsCount: number) => {
    const newGroups: PromRuleGroupDTO[] = [];
    for (let i = 0; i < groupsCount; i++) {
      const group = await groupsGenerator.current.next();
      if (group.done) {
        setHasNextPage(false);
        break;
      }
      newGroups.push(group.value);
    }

    setGroups((groups) => [...groups, ...newGroups]);
  }, []);

  const nextPage = useCallback(async () => {
    if (hasNextPage) {
      setCurrentPage((page) => page + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(async () => {
    if (currentPage !== 1) {
      setCurrentPage((page) => page - 1);
    }
  }, [currentPage]);

  useEffect(() => {
    // We fetch 2 pages to load the page in the background rather than waiting for the user to click next
    if (groups.length - pageSize < pageSize * currentPage) {
      fetchMoreGroups(pageSize * 2);
    }
  }, [fetchMoreGroups, groups.length, pageSize, currentPage]);

  const pageNamespaces = useMemo(() => {
    const pageGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    // groupRulesByFileName mutates the array and RTKQ query freezes the response data
    return groupRulesByFileName(structuredClone(pageGroups), ruleSourceName);
  }, [groups, ruleSourceName, currentPage, pageSize]);

  return { isLoading, page: pageNamespaces, nextPage, previousPage, hasNextPage, currentPage };
}

interface LazyPaginationProps {
  hasNextPage: boolean;
  currentPage: number;
  nextPage: () => void;
  previousPage: () => void;
}

function LazyPagination({ hasNextPage, currentPage, nextPage, previousPage }: LazyPaginationProps) {
  return (
    <Stack direction="row" gap={1}>
      <Button
        aria-label={`previous page`}
        size="sm"
        variant="secondary"
        onClick={previousPage}
        disabled={currentPage === 1}
      >
        <Icon name="angle-left" />
      </Button>
      <Button aria-label={`next page`} size="sm" variant="secondary" onClick={nextPage} disabled={!hasNextPage}>
        <Icon name="angle-right" />
      </Button>
    </Stack>
  );
}

interface AlertRuleLoaderProps {
  rule: Rule;
  groupIdentifier: RuleGroupIdentifier;
  rulerEnabled?: boolean;
}

function AlertRuleLoader({ rule, groupIdentifier, rulerEnabled = false }: AlertRuleLoaderProps) {
  const { dataSourceName, namespaceName, groupName } = groupIdentifier;

  const ruleIdentifier = fromRule(dataSourceName, namespaceName, groupName, rule);
  const href = createViewLinkFromIdentifier(ruleIdentifier);
  const originMeta = getRulePluginOrigin(rule);

  // @TODO work with context API to propagate rulerConfig and such
  const { data: dataSourceInfo } = useDiscoverDsFeaturesQuery({ rulesSourceName: dataSourceName });

  // @TODO refactor this to use a separate hook (useRuleWithLocation() and useCombinedRule() seems to introduce infinite loading / recursion)
  const {
    isLoading,
    data: rulerRuleGroup,
    // error,
  } = useGetRuleGroupForNamespaceQuery(
    {
      namespace: namespaceName,
      group: groupName,
      rulerConfig: dataSourceInfo?.rulerConfig!,
    },
    { skip: !dataSourceInfo?.rulerConfig }
  );

  const rulerRule = useMemo(() => {
    if (!rulerRuleGroup) {
      return;
    }

    return rulerRuleGroup.rules.find((rule) =>
      equal(fromRulerRule(dataSourceName, namespaceName, groupName, rule), ruleIdentifier)
    );
  }, [dataSourceName, groupName, namespaceName, ruleIdentifier, rulerRuleGroup]);

  // 1. get the rule from the ruler API with "ruleWithLocation"
  // 1.1 skip this if this datasource does not have a ruler
  //
  // 2.1 render action buttons
  // 2.2 render provisioning badge and contact point metadata, etc.

  const actions = useMemo(() => {
    if (!rulerEnabled) {
      return null;
    }

    if (isLoading) {
      return <ActionsLoader />;
    }

    if (rulerRule) {
      return <RuleActionsButtons rule={rulerRule} promRule={rule} groupIdentifier={groupIdentifier} compact />;
    }

    return null;
  }, [groupIdentifier, isLoading, rule, rulerEnabled, rulerRule]);

  if (isAlertingRule(rule)) {
    return (
      <AlertRuleListItem
        name={rule.name}
        href={href}
        summary={rule.annotations?.summary}
        state={rule.state}
        health={rule.health}
        error={rule.lastError}
        labels={rule.labels}
        isProvisioned={undefined}
        instancesCount={undefined}
        actions={actions}
        origin={originMeta}
      />
    );
  }

  if (isRecordingRule(rule)) {
    return (
      <RecordingRuleListItem
        name={rule.name}
        href={href}
        health={rule.health}
        error={rule.lastError}
        labels={rule.labels}
        isProvisioned={undefined}
        actions={null}
        origin={originMeta}
      />
    );
  }

  return <UnknownRuleListItem rule={rule} groupIdentifier={groupIdentifier} />;
}

function createViewLinkFromIdentifier(identifier: RuleIdentifier, returnTo?: string) {
  const paramId = encodeURIComponent(stringifyIdentifier(identifier));
  const paramSource = encodeURIComponent(identifier.ruleSourceName);

  return createRelativeUrl(`/alerting/${paramSource}/${paramId}/view`, returnTo ? { returnTo } : {});
}

interface DataSourceSectionProps extends PropsWithChildren {
  uid?: string;
  name?: string;
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
    <Stack direction="column" gap={1}>
      <Stack direction="column" gap={0}>
        {isLoading && <LoadingIndicator />}
        <div className={styles.dataSourceSectionTitle}>
          {loader ?? (
            <Stack alignItems="center">
              {application && <DataSourceIcon application={application} />}
              {name && (
                <Text variant="body" weight="bold">
                  {name}
                </Text>
              )}
              {description && (
                <>
                  {'·'}
                  {description}
                </>
              )}
              <Spacer />
              {uid && (
                <WithReturnButton
                  title="alert rules"
                  component={
                    <LinkButton variant="secondary" size="sm" href={`/connections/datasources/edit/${uid}`}>
                      <Trans i18nKey="alerting.rule-list.configure-datasource">Configure</Trans>
                    </LinkButton>
                  }
                />
              )}
            </Stack>
          )}
        </div>
      </Stack>
      <div className={styles.itemsWrapper}>{children}</div>
    </Stack>
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

export default RuleList;
