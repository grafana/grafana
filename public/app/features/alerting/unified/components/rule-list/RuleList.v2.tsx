import { css } from '@emotion/css';
import { PropsWithChildren, ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, Pagination, Stack, Text, useStyles2, withErrorBoundary } from '@grafana/ui';
import { Rule, RuleGroupIdentifier, RuleIdentifier } from 'app/types/unified-alerting';
import { RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { getAllRulesSources, isGrafanaRulesSource } from '../../utils/datasource';
import { fromRule, hashRule, stringifyIdentifier } from '../../utils/rule-id';
import { getRulePluginOrigin, isAlertingRule, isRecordingRule } from '../../utils/rules';
import { createRelativeUrl } from '../../utils/url';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { Spacer } from '../Spacer';
import { WithReturnButton } from '../WithReturnButton';
import RulesFilter from '../rules/Filter/RulesFilter';

import { AlertRuleListItem, RecordingRuleListItem } from './AlertRuleListItem';
import { DataSourceIcon } from './Namespace';
import { ListGroup } from './components/ListGroup';
import { ListSection } from './components/ListSection';

const noop = () => {};
const { usePrometheusRuleNamespacesQuery } = alertRuleApi;

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
  // grab prom rules paginated
  return <DataSourceSection name="Grafana" application="grafana"></DataSourceSection>;
};

// 1. grab BuildInfo
const DataSourceLoader = ({ uid, name }: DataSourceLoaderProps) => {
  const { data: dataSourceInfo, isLoading } = useDiscoverDsFeaturesQuery({ uid });
  let application: RulesSourceApplication | undefined;

  if (dataSourceInfo?.dataSourceSettings.type === 'loki') {
    application = 'loki';
  } else {
    application = dataSourceInfo?.features.application;
  }

  if (isLoading) {
    return <DataSourceSection loader={<Skeleton width={250} height={16} />}></DataSourceSection>;
  }

  // 2. grab prometheus rule groups with max_groups if supported
  if (dataSourceInfo) {
    const rulerEnabled = Boolean(dataSourceInfo.rulerConfig);

    return (
      <DataSourceSection name={name} application={application} uid={uid}>
        <PaginatedRuleGroupLoader
          ruleSourceName={dataSourceInfo?.dataSourceSettings.name}
          rulerEnabled={rulerEnabled}
        />
      </DataSourceSection>
    );
  }

  return null;
};

interface PaginatedRuleGroupLoaderProps {
  ruleSourceName: string;
  rulerEnabled?: boolean;
}

function PaginatedRuleGroupLoader({ ruleSourceName, rulerEnabled = false }: PaginatedRuleGroupLoaderProps) {
  const { data: ruleNamespaces = [] } = usePrometheusRuleNamespacesQuery({
    ruleSourceName,
    maxGroups: 25,
    limitAlerts: 0,
    excludeAlerts: true,
  });

  return (
    <Stack direction="column">
      {ruleNamespaces.map((namespace) => (
        <ListSection key={namespace.name} title={namespace.name}>
          {namespace.groups.map((group) => (
            <ListGroup key={group.name} name={group.name} onToggle={noop} isOpen={true}>
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
      <Pagination currentPage={1} numberOfPages={0} onNavigate={noop} />
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

  // const { loading, result: ruleWithLocation, error } = useRuleWithLocation({ ruleIdentifier });
  // 1. get the rule from the ruler API with "ruleWithLocation"
  // 1.1 skip this if this datasource does not have a ruler
  //
  // 2.1 render action buttons
  // 2.2 render provisioning badge and contact point metadata, etc.

  // let actions: ReactNode;

  // if (!rulerEnabled) {
  //   actions = null;
  // } else {
  //   if (loading) {
  //     actions = <Skeleton width={50} height={16} />;
  //   } else if (ruleWithLocation) {
  //     actions = (
  //       <RuleActionsButtons
  //         rule={ruleWithLocation.rule}
  //         promRule={rule}
  //         groupIdentifier={groupIdentifier}
  //         compact
  //         showCopyLinkButton={true}
  //       />
  //     );
  //   }
  // }

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
        actions={null}
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
}

const DataSourceSection = ({ uid, name, application, children, loader }: DataSourceSectionProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.dataSourceSection}>
      <div className={styles.dataSourceSectionTitle}>
        {loader ?? (
          <Stack alignItems="center">
            {application && <DataSourceIcon application={application} />}
            {name && (
              <Text variant="body" weight="bold">
                {name}
              </Text>
            )}
            <Spacer />
            {uid && (
              <WithReturnButton
                title="alert rules"
                component={
                  <LinkButton variant="secondary" size="sm" href={`/connections/datasources/edit/${uid}`}>
                    Configure
                  </LinkButton>
                }
              />
            )}
          </Stack>
        )}
      </div>
      <div className={styles.itemsWrapper}>{children}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  dataSourceSection: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    // border: `solid 1px ${theme.colors.border.weak}`,
    padding: `${theme.spacing(0)} ${theme.spacing(1)}`,
    // borderRadius: theme.shape.radius.default,
  }),
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
