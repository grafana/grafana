import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import pluralize from 'pluralize';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Stack, Text, TextLink, Dropdown, Button, Menu, Alert } from '@grafana/ui';
import { CombinedRule, RuleHealth } from 'app/types/unified-alerting';
import { Labels, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { logError } from '../../Analytics';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { labelsSize } from '../../utils/labels';
import { createContactPointLink } from '../../utils/misc';
import { MetaText } from '../MetaText';
import MoreButton from '../MoreButton';
import { Spacer } from '../Spacer';

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
  evaluationDuration?: number;
  labels?: Labels;
  instancesCount?: number;
  // used for alert rules that use simplified routing
  contactPoint?: string;
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
    contactPoint,
    labels,
  } = props;
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems="start" gap={1} wrap="nowrap">
        <RuleListIcon state={state} health={health} isPaused={isPaused} />
        <Stack direction="column" gap={0.5} flex="1">
          <div>
            <Stack direction="column" gap={0}>
              <Stack direction="row" alignItems="start">
                <TextLink href={href} inline={false}>
                  {name}
                </TextLink>
                {/* let's not show labels for now, but maybe users would be interested later? Or maybe show them only in the list view? */}
                {/* {labels && <AlertLabels labels={labels} size="xs" />} */}
              </Stack>
              <Summary content={summary} error={error} />
            </Stack>
          </div>
          <div>
            <Stack direction="row" gap={1}>
              {/* show evaluation-related metadata if the rule isn't paused – paused rules don't have instances and shouldn't show evaluation timestamps */}
              {!isPaused && (
                <>
                  <EvaluationMetadata
                    lastEvaluation={lastEvaluation}
                    evaluationInterval={evaluationInterval}
                    health={health}
                    state={state}
                    error={error}
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
          </div>
        </Stack>

        <Stack direction="row" alignItems="center" gap={1} wrap="nowrap">
          <Button variant="secondary" size="sm" icon="pen" type="button" disabled={isProvisioned}>
            Edit
          </Button>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item label="Silence" icon="bell-slash" />
                <Menu.Divider />
                <Menu.Item label="Export" disabled={isProvisioned} icon="download-alt" />
                <Menu.Item label="Delete" disabled={isProvisioned} icon="trash-alt" destructive />
              </Menu>
            }
          >
            <MoreButton />
          </Dropdown>
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
      <Text variant="bodySmall" color="error" weight="light" truncate>
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

// @TODO use Pick<> or Omit<> here
interface RecordingRuleListItemProps {
  name: string;
  href: string;
  error?: string;
  health?: RuleHealth;
  recording?: boolean;
  state?: PromAlertingRuleState;
  labels?: Labels;
  isProvisioned?: boolean;
  lastEvaluation?: string;
  evaluationInterval?: string;
  evaluationDuration?: number;
}

// @TODO split in to smaller re-usable bits
export const RecordingRuleListItem = ({
  name,
  error,
  state,
  health,
  isProvisioned,
  href,
  labels,
  lastEvaluation,
  evaluationInterval,
}: RecordingRuleListItemProps) => {
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack direction="row" alignItems="start" gap={1} flex="1">
          <RuleListIcon health={health} recording />
          <Stack direction="column" gap={0.5}>
            <Stack direction="column" gap={0}>
              <Stack direction="row" alignItems="start">
                <TextLink href={href} variant="body" weight="bold" inline={false}>
                  {name}
                </TextLink>
                {/* {labels && <AlertLabels labels={labels} size="xs" />} */}
              </Stack>
              <Summary error={error} />
            </Stack>
            <div>
              <Stack direction="row" gap={1}>
                <EvaluationMetadata
                  lastEvaluation={lastEvaluation}
                  evaluationInterval={evaluationInterval}
                  health={health}
                  state={state}
                  error={error}
                />
                {!isEmpty(labels) && (
                  <MetaText icon="tag-alt">
                    <TextLink variant="bodySmall" color="primary" href={href} inline={false}>
                      {pluralize('label', labelsSize(labels), true)}
                    </TextLink>
                  </MetaText>
                )}
              </Stack>
            </div>
          </Stack>
          <Spacer />
          <Button
            variant="secondary"
            size="sm"
            icon="pen"
            type="button"
            disabled={isProvisioned}
            data-testid="edit-rule-action"
          >
            Edit
          </Button>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item label="Export" disabled={isProvisioned} icon="download-alt" />
                <Menu.Item label="Delete" disabled={isProvisioned} icon="trash-alt" destructive />
              </Menu>
            }
          >
            <MoreButton />
          </Dropdown>
        </Stack>
      </Stack>
    </li>
  );
};

interface EvaluationMetadataProps {
  lastEvaluation?: string;
  evaluationInterval?: string;
  state?: PromAlertingRuleState;
  health?: RuleHealth;
  error?: string; // if health is "error" this should have error details for us
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
