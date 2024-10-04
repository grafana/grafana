import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import pluralize from 'pluralize';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Icon, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { CombinedRule, CombinedRuleNamespace, RuleHealth } from 'app/types/unified-alerting';
import { Labels, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { logError } from '../../Analytics';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { labelsSize } from '../../utils/labels';
import { createContactPointLink } from '../../utils/misc';
import { RulePluginOrigin } from '../../utils/rules';
import { MetaText } from '../MetaText';
import { ProvisioningBadge } from '../Provisioning';

import { RuleListIcon } from './RuleListIcon';
import { ListItem } from './components/ListItem';
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
  namespace?: CombinedRuleNamespace;
  group?: string;
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
    contactPoint,
    labels,
    origin,
    actions = null,
  } = props;
  const styles = useStyles2(getStyles);

  const metadata: ReactNode[] = [];
  if (namespace && group) {
    metadata.push(
      <Text color="secondary" variant="bodySmall">
        <RuleLocation namespace={namespace} group={group} />
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

  if (!isEmpty(labels)) {
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
        Delivered to{' '}
        <TextLink
          href={createContactPointLink(contactPoint, GRAFANA_RULES_SOURCE_NAME)}
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

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems="start" gap={1} wrap="nowrap">
        {/* rule state */}
        <RuleListIcon state={state} health={health} isPaused={isPaused} />

        {/* rule metadata */}
        <Stack direction="column" gap={0.5} flex="1">
          <Stack direction="column" gap={0}>
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
            <Summary content={summary} error={error} />
          </Stack>

          <Stack direction="row" gap={1}>
            {namespace && group && (
              <Text color="secondary" variant="bodySmall">
                <RuleLocation namespace={namespace} group={group} />
              </Text>
            )}
            {/* show evaluation-related metadata if the rule isn't paused – paused rules don't have instances and shouldn't show evaluation timestamps */}
            {!isPaused && (
              <>
                <EvaluationMetadata
                  lastEvaluation={lastEvaluation}
                  evaluationInterval={evaluationInterval}
                  state={state}
                />
                <MetaText icon="layers-alt">
                  <TextLink href={href + '?tab=instances'} variant="bodySmall" color="primary" inline={false}>
                    {pluralize('instance', instancesCount, true)}
                  </TextLink>
                </MetaText>
              </>
            )}

            {/* show label count */}
            {!isEmpty(labels) && (
              <MetaText icon="tag-alt">
                <TextLink href={href} variant="bodySmall" color="primary" inline={false}>
                  {pluralize('label', labelsSize(labels), true)}
                </TextLink>
              </MetaText>
            )}

            {/* show if the alert rule is using direct contact point or notification policy routing, not for paused rules or recording rules */}
            {contactPoint && !isPaused && (
              <MetaText icon="at">
                Delivered to{' '}
                <TextLink
                  href={createContactPointLink(contactPoint, GRAFANA_RULES_SOURCE_NAME)}
                  variant="bodySmall"
                  color="primary"
                  inline={false}
                >
                  {contactPoint}
                </TextLink>
              </MetaText>
            )}
          </Stack>
        </Stack>

        {/* rule actions */}
        <Stack direction="row" alignItems="center" gap={1} wrap="nowrap">
          {actions}
        </Stack>
      </Stack>
    </li>
  );
};

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
        Firing for <Text color="primary">{firingFor}</Text>
        {nextEvaluation && <>· next evaluation in {nextEvaluation.humanized}</>}
      </MetaText>
    );
  }

  // for recording rules and normal or pending state alert rules we just show when we evaluated last and how long that took
  if (nextEvaluation) {
    return <MetaText icon="clock-nine">Next evaluation {nextEvaluation.humanized}</MetaText>;
  }

  return null;
}

interface UnknownRuleListItemProps {
  rule: CombinedRule;
}

export const UnknownRuleListItem = ({ rule }: UnknownRuleListItemProps) => {
  const styles = useStyles2(getStyles);

  const ruleContext = { namespace: rule.namespace.name, group: rule.group.name, name: rule.name };
  logError(new Error('unknown rule type'), ruleContext);

  return (
    <Alert title={'Unknown rule type'} className={styles.resetMargin}>
      <details>
        <summary>Rule definition</summary>
        <pre>
          <code>{JSON.stringify(rule.rulerRule, null, 2)}</code>
        </pre>
      </details>
    </Alert>
  );
};

interface RuleLocationProps {
  namespace: CombinedRuleNamespace;
  group: string;
}

export const RuleLocation = ({ namespace, group }: RuleLocationProps) => (
  <Stack direction="row" alignItems="center" gap={0.5}>
    <Icon size="xs" name="folder" />
    <Stack direction="row" alignItems="center" gap={0}>
      {namespace.name}
      <Icon size="sm" name="angle-right" />
      {group}
    </Stack>
  </Stack>
);

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
