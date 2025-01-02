import { css } from '@emotion/css';
import pluralize from 'pluralize';
import { ReactNode, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Icon, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { Rule, RuleGroupIdentifierV2, RuleHealth, RulesSourceIdentifier } from 'app/types/unified-alerting';
import { Labels, PromAlertingRuleState, RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { logError } from '../../Analytics';
import { MetaText } from '../../components/MetaText';
import { ProvisioningBadge } from '../../components/Provisioning';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { getGroupOriginName } from '../../utils/groupIdentifier';
import { labelsSize } from '../../utils/labels';
import { createContactPointSearchLink } from '../../utils/misc';
import { RulePluginOrigin } from '../../utils/rules';

import { ListItem } from './ListItem';
import { DataSourceIcon } from './Namespace';
import { RuleListIcon } from './RuleListIcon';
import { calculateNextEvaluationEstimate } from './util';

interface AlertRuleListItemProps {
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
  rulesSource?: RulesSourceIdentifier;
  application?: RulesSourceApplication;
  // used for alert rules that use simplified routing
  contactPoint?: string;
  actions?: ReactNode;
  origin?: RulePluginOrigin;
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
    rulesSource,
    application,
    contactPoint,
    labels,
    origin,
    actions = null,
  } = props;

  const metadata: ReactNode[] = [];
  if (namespace && group) {
    metadata.push(
      <Text color="secondary" variant="bodySmall">
        <RuleLocation namespace={namespace} group={group} rulesSource={rulesSource} application={application} />
      </Text>
    );
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

  if (labelsSize(labels) > 0) {
    metadata.push(
      <MetaText icon="tag-alt">
        <TextLink href={href} variant="bodySmall" color="primary" inline={false}>
          {pluralize('label', labelsSize(labels), true)}
        </TextLink>
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
      title={
        <Stack direction="row" alignItems="center">
          <TextLink href={href} inline={false}>
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
      icon={<RuleListIcon state={state} health={health} isPaused={isPaused} />}
      actions={actions}
      meta={metadata}
    />
  );
};

type RecordingRuleListItemProps = Omit<AlertRuleListItemProps, 'summary' | 'state' | 'instancesCount' | 'contactPoint'>;

export function RecordingRuleListItem({
  name,
  namespace,
  group,
  rulesSource,
  application,
  href,
  health,
  isProvisioned,
  error,
  isPaused,
  origin,
  actions,
}: RecordingRuleListItemProps) {
  const metadata: ReactNode[] = [];
  if (namespace && group) {
    metadata.push(
      <Text color="secondary" variant="bodySmall">
        <RuleLocation namespace={namespace} group={group} rulesSource={rulesSource} application={application} />
      </Text>
    );
  }

  return (
    <ListItem
      title={
        <Stack direction="row" alignItems="center">
          <TextLink href={href} inline={false}>
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
      <Text variant="bodySmall" color="secondary">
        {content}
      </Text>
    );
  }

  return null;
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
  rule: Rule;
  groupIdentifier: RuleGroupIdentifierV2;
}

export const UnknownRuleListItem = ({ rule, groupIdentifier }: UnknownRuleListItemProps) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const { namespace, groupName } = groupIdentifier;
    const ruleContext = {
      name: rule.name,
      groupName,
      namespace: JSON.stringify(namespace),
      rulesSource: getGroupOriginName(groupIdentifier),
    };
    logError(new Error('unknown rule type'), ruleContext);
  }, [rule, groupIdentifier]);

  return (
    <Alert title={'Unknown rule type'} className={styles.resetMargin}>
      <details>
        <summary>
          <Trans i18nKey="alerting.alert-rules.rule-definition">Rule definition</Trans>
        </summary>
        <pre>
          <code>{JSON.stringify(rule, null, 2)}</code>
        </pre>
      </details>
    </Alert>
  );
};

interface RuleLocationProps {
  namespace: string;
  group: string;
  rulesSource?: RulesSourceIdentifier;
  application?: RulesSourceApplication;
}

// @TODO make the datasource / namespace / group click-able to allow further filtering of the list
export const RuleLocation = ({ namespace, group, rulesSource, application }: RuleLocationProps) => {
  const isGrafanaApp = application === 'grafana';
  const isDataSourceApp = !!rulesSource && !!application && !isGrafanaApp;

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {isGrafanaApp && <Icon size="xs" name="folder" />}
      {isDataSourceApp && (
        <Tooltip content={rulesSource.name}>
          <span>
            <DataSourceIcon application={application} size={14} />
          </span>
        </Tooltip>
      )}

      <Stack direction="row" alignItems="center" gap={0}>
        {namespace}
        <Icon size="sm" name="angle-right" />
        {group}
      </Stack>
    </Stack>
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
});
