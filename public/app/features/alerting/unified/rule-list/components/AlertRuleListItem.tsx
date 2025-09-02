import { css, cx } from '@emotion/css';
import pluralize from 'pluralize';
import { ReactNode, forwardRef, memo, useEffect, useId } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { Rule, RuleGroupIdentifierV2, RuleHealth, RulesSourceIdentifier } from 'app/types/unified-alerting';
import { Labels, PromAlertingRuleState, RulerRuleDTO, RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { logError } from '../../Analytics';
import { AlertLabels } from '../../components/AlertLabels';
import ConditionalWrap from '../../components/ConditionalWrap';
import { MetaText } from '../../components/MetaText';
import { ProvisioningBadge } from '../../components/Provisioning';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { GRAFANA_RULES_SOURCE_NAME, getDataSourceByUid } from '../../utils/datasource';
import { getGroupOriginName } from '../../utils/groupIdentifier';
import { labelsSize } from '../../utils/labels';
import { createContactPointSearchLink, makeDataSourceLink } from '../../utils/misc';
import { RulePluginOrigin } from '../../utils/rules';

import { ListItem } from './ListItem';
import { RuleListIcon, RuleOperation } from './RuleListIcon';
import { RuleLocation } from './RuleLocation';
import { calculateNextEvaluationEstimate } from './util';

export interface AlertRuleListItemProps {
  name: string;
  href: string;
  summary?: string;
  error?: string;
  state?: PromAlertingRuleState;
  isPaused?: boolean;
  health?: RuleHealth;
  isProvisioned?: boolean;
  lastEvaluation?: string;
  evaluationInterval?: string;
  labels?: Labels;
  instancesCount?: number;
  namespace?: string;
  group?: string;
  groupUrl?: string;
  rulesSource?: RulesSourceIdentifier;
  application?: RulesSourceApplication;
  // used for alert rules that use simplified routing
  contactPoint?: string;
  actions?: ReactNode;
  origin?: RulePluginOrigin;
  operation?: RuleOperation;
  // the grouped view doesn't need to show the location again – it's redundant
  showLocation?: boolean;
  querySourceUIDs?: string[];
}

export const AlertRuleListItem = (props: AlertRuleListItemProps) => {
  const {
    name,
    summary,
    state,
    health,
    error,
    href,
    isProvisioned,
    lastEvaluation,
    evaluationInterval,
    isPaused = false,
    instancesCount = 0,
    namespace,
    group,
    groupUrl,
    rulesSource,
    application,
    contactPoint,
    labels,
    origin,
    actions = null,
    operation,
    showLocation = true,
    querySourceUIDs = [],
  } = props;

  const listItemAriaId = useId();

  const metadata: ReactNode[] = [];
  if (namespace && group && showLocation) {
    metadata.push(
      <Text color="secondary" variant="bodySmall">
        <RuleLocation
          namespace={namespace}
          group={group}
          groupUrl={groupUrl}
          rulesSource={rulesSource}
          application={application}
        />
      </Text>
    );
  }

  if (querySourceUIDs.length > 0) {
    metadata.push(<QuerySourceIcons queriedDatasourceUIDs={querySourceUIDs} />);
  }

  if (!isPaused) {
    if (lastEvaluation && evaluationInterval) {
      metadata.push(
        <EvaluationMetadata lastEvaluation={lastEvaluation} evaluationInterval={evaluationInterval} state={state} />
      );
    }

    if (instancesCount) {
      metadata.push(
        <MetaText icon="layers-alt">
          <TextLink href={href + '?tab=instances'} variant="bodySmall" color="primary" inline={false}>
            {pluralize('instance', instancesCount, true)}
          </TextLink>
        </MetaText>
      );
    }
  }

  if (labels && labelsSize(labels) > 0) {
    metadata.push(
      <MetaText icon="tag-alt">
        <RuleLabels labels={labels} />
      </MetaText>
    );
  }

  if (!isPaused && contactPoint) {
    metadata.push(
      <MetaText icon="at">
        <Trans i18nKey="alerting.contact-points.delivered-to">Delivered to</Trans>{' '}
        <TextLink
          href={createContactPointSearchLink(contactPoint, GRAFANA_RULES_SOURCE_NAME)}
          variant="bodySmall"
          color="primary"
          inline={false}
        >
          {contactPoint}
        </TextLink>
      </MetaText>
    );
  }

  return (
    <ListItem
      aria-labelledby={listItemAriaId}
      title={
        <Stack direction="row" alignItems="center">
          <TextLink href={href} color="primary" inline={false} id={listItemAriaId}>
            {name}
          </TextLink>
          {origin && <PluginOriginBadge pluginId={origin.pluginId} size="sm" />}
          {/* show provisioned badge only when it also doesn't have plugin origin */}
          {isProvisioned && !origin && <ProvisioningBadge />}
          {/* let's not show labels for now, but maybe users would be interested later? Or maybe show them only in the list view? */}
          {/* {labels && <AlertLabels labels={labels} size="xs" />} */}
        </Stack>
      }
      description={<Summary content={summary} error={error} />}
      icon={<RuleListIcon state={state} health={health} isPaused={isPaused} operation={operation} />}
      actions={actions}
      meta={metadata}
    />
  );
};

export type RecordingRuleListItemProps = Omit<
  AlertRuleListItemProps,
  'summary' | 'state' | 'instancesCount' | 'contactPoint'
>;

export function RecordingRuleListItem({
  name,
  namespace,
  group,
  groupUrl,
  rulesSource,
  application,
  href,
  health,
  isProvisioned,
  error,
  isPaused,
  origin,
  actions,
  showLocation = true,
  querySourceUIDs = [],
}: RecordingRuleListItemProps) {
  const metadata: ReactNode[] = [];
  if (namespace && group && showLocation) {
    metadata.push(
      <Text color="secondary" variant="bodySmall">
        <RuleLocation
          namespace={namespace}
          group={group}
          groupUrl={groupUrl}
          rulesSource={rulesSource}
          application={application}
        />
      </Text>
    );
  }

  if (querySourceUIDs.length > 0) {
    metadata.push(<QuerySourceIcons queriedDatasourceUIDs={querySourceUIDs} />);
  }

  return (
    <ListItem
      title={
        <Stack direction="row" alignItems="center">
          <TextLink color="primary" href={href} inline={false}>
            {name}
          </TextLink>
          {origin && <PluginOriginBadge pluginId={origin.pluginId} size="sm" />}
          {/* show provisioned badge only when it also doesn't have plugin origin */}
          {isProvisioned && !origin && <ProvisioningBadge />}
          {/* let's not show labels for now, but maybe users would be interested later? Or maybe show them only in the list view? */}
          {/* {labels && <AlertLabels labels={labels} size="xs" />} */}
        </Stack>
      }
      description={<Summary error={error} />}
      icon={<RuleListIcon recording={true} health={health} isPaused={isPaused} />}
      actions={actions}
      meta={metadata}
    />
  );
}

interface RuleOperationListItemProps {
  name: string;
  namespace: string;
  group: string;
  groupUrl?: string;
  rulesSource?: RulesSourceIdentifier;
  application?: RulesSourceApplication;
  operation: RuleOperation;
  showLocation?: boolean;
}

export function RuleOperationListItem({
  name,
  namespace,
  group,
  groupUrl,
  rulesSource,
  application,
  operation,
  showLocation = true,
}: RuleOperationListItemProps) {
  const listItemAriaId = useId();

  const metadata: ReactNode[] = [];
  if (namespace && group && showLocation) {
    metadata.push(
      <Text color="secondary" variant="bodySmall">
        <RuleLocation
          namespace={namespace}
          group={group}
          groupUrl={groupUrl}
          rulesSource={rulesSource}
          application={application}
        />
      </Text>
    );
  }

  return (
    <ListItem
      aria-labelledby={listItemAriaId}
      title={
        <Stack direction="row" alignItems="center">
          <Text id={listItemAriaId}>{name}</Text>
        </Stack>
      }
      icon={<RuleListIcon operation={operation} />}
      meta={metadata}
    />
  );
}

interface SummaryProps {
  content?: string;
  error?: string;
}

function Summary({ content, error }: SummaryProps) {
  if (error) {
    return (
      <Text variant="bodySmall" color="error" weight="light" truncate element="p">
        {error}
      </Text>
    );
  }
  if (content) {
    return (
      <Text variant="bodySmall" color="secondary" truncate>
        {content}
      </Text>
    );
  }

  return null;
}

interface QuerySourceIconsProps {
  queriedDatasourceUIDs: string[];
}

const QuerySourceIcons = memo(function QuerySourceIcons({ queriedDatasourceUIDs }: QuerySourceIconsProps) {
  // Make icons unique - deduplicate datasource UIDs
  const dataSources = Array.from(new Set(queriedDatasourceUIDs))
    .map(getDataSourceByUid)
    .filter((ds): ds is DataSourceInstanceSettings => ds !== undefined);

  const firstSource = dataSources[0];
  const singleSource = dataSources.length === 1;

  const label = singleSource
    ? firstSource.name
    : t('alerting.alert-rules.multiple-sources', '{{numSources}} data sources', { numSources: dataSources.length });

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {dataSources.map((dataSource) => (
        <ConditionalWrap
          key={dataSource.uid}
          shouldWrap={!singleSource}
          wrap={(children) => <Tooltip content={dataSource.name}>{children}</Tooltip>}
        >
          <DataSourceLogo dataSource={dataSource} />
        </ConditionalWrap>
      ))}

      {singleSource ? (
        <TextLink variant="bodySmall" inline={false} color="primary" href={makeDataSourceLink(firstSource.uid)}>
          {label}
        </TextLink>
      ) : (
        <Text variant="bodySmall" color="primary">
          {label}
        </Text>
      )}
    </Stack>
  );
});

function RuleLabels({ labels }: { labels: Labels }) {
  const styles = useStyles2(getStyles);

  return (
    <Tooltip
      content={
        <div className={styles.ruleLabels.tooltip}>
          <AlertLabels labels={labels} size="sm" />
        </div>
      }
      placement="right"
      interactive
    >
      <div>
        <Text variant="bodySmall" color="primary">
          {pluralize('label', labelsSize(labels), true)}
        </Text>
      </div>
    </Tooltip>
  );
}

interface EvaluationMetadataProps {
  lastEvaluation?: string;
  evaluationInterval?: string;
  state?: PromAlertingRuleState;
}

function EvaluationMetadata({ lastEvaluation, evaluationInterval, state }: EvaluationMetadataProps) {
  const nextEvaluation = calculateNextEvaluationEstimate(lastEvaluation, evaluationInterval);

  // @TODO support firing for calculation
  if (state === PromAlertingRuleState.Firing && nextEvaluation) {
    const firingFor = '2m 34s';

    return (
      <MetaText icon="clock-nine">
        <Trans i18nKey="alerting.alert-rules.firing-for">Firing for</Trans> <Text color="primary">{firingFor}</Text>
        {nextEvaluation && (
          <>
            {'· '}
            <Trans i18nKey="alerting.alert-rules.next-evaluation-in">next evaluation in</Trans>{' '}
            {nextEvaluation.humanized}
          </>
        )}
      </MetaText>
    );
  }

  // for recording rules and normal or pending state alert rules we just show when we evaluated last and how long that took
  if (nextEvaluation) {
    return (
      <MetaText icon="clock-nine">
        <Trans i18nKey="alerting.alert-rules.next-evaluation">Next evaluation</Trans> {nextEvaluation.humanized}
      </MetaText>
    );
  }

  return null;
}

interface UnknownRuleListItemProps {
  ruleName: string;
  groupIdentifier: RuleGroupIdentifierV2;
  ruleDefinition: Rule | RulerRuleDTO;
}

export const UnknownRuleListItem = ({ ruleName, groupIdentifier, ruleDefinition }: UnknownRuleListItemProps) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const { namespace, groupName } = groupIdentifier;
    const ruleContext = {
      name: ruleName,
      groupName,
      namespace: JSON.stringify(namespace),
      rulesSource: getGroupOriginName(groupIdentifier),
    };
    logError(new Error('unknown rule type'), ruleContext);
  }, [ruleName, groupIdentifier]);

  return (
    <Alert
      title={t('alerting.unknown-rule-list-item.title-unknown-rule-type', 'Unknown rule type')}
      className={styles.resetMargin}
    >
      <details>
        <summary>
          <Trans i18nKey="alerting.alert-rules.rule-definition">Rule definition</Trans>
        </summary>
        <pre>
          <code>{JSON.stringify(ruleDefinition, null, 2)}</code>
        </pre>
      </details>
    </Alert>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  alertListItemContainer: css({
    position: 'relative',
    listStyle: 'none',
    background: theme.colors.background.primary,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    padding: theme.spacing(1, 1, 1, 1.5),
  }),
  resetMargin: css({
    margin: 0,
  }),
  ruleLabels: {
    tooltip: css({
      padding: theme.spacing(1),
    }),
    text: css({
      cursor: 'pointer',
    }),
  },
});

export type RuleListItemCommonProps = Pick<
  AlertRuleListItemProps,
  Extract<keyof AlertRuleListItemProps, keyof RecordingRuleListItemProps>
>;

interface DataSourceLogoProps {
  dataSource: DataSourceInstanceSettings;
}

const DataSourceLogo = forwardRef<HTMLImageElement, DataSourceLogoProps>(({ dataSource }, ref) => {
  const styles = useStyles2(dataSourceLogoStyles);

  return (
    <img
      ref={ref}
      className={cx(styles.logo, {
        [styles.filter]: dataSource.meta.builtIn,
      })}
      alt={`${dataSource.meta.name} logo`}
      src={dataSource.meta.info.logos.small}
    />
  );
});
DataSourceLogo.displayName = 'DataSourceLogo';

const dataSourceLogoStyles = (theme: GrafanaTheme2) => ({
  logo: css({
    height: '12px',
    width: '12px',
    borderRadius: theme.shape.radius.default,
  }),
  filter: css({
    filter: `invert(${theme.isLight ? 1 : 0})`,
  }),
});
