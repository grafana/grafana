import { css } from '@emotion/css';
import { isEmpty, size } from 'lodash';
import pluralize from 'pluralize';
import React from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { useStyles2, Stack, Text, Icon, TextLink, Dropdown, Button, Menu, Tooltip } from '@grafana/ui';
import { TextProps } from '@grafana/ui/src/components/Text/Text';
import { Time } from 'app/features/explore/Time';
import { RuleHealth } from 'app/types/unified-alerting';
import { Labels, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { formatPrometheusDuration } from '../../utils/time';
import { AlertLabels } from '../AlertLabels';
import { MetaText } from '../MetaText';
import MoreButton from '../MoreButton';
import { Spacer } from '../Spacer';
import { isErrorHealth } from '../rule-viewer/RuleViewer';

import { calculateNextEvaluationEstimate, getRelativeEvaluationInterval } from './util';

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
    evaluationDuration,
    evaluationInterval,
    isPaused = false,
    instancesCount = 0,
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
                {labels && <AlertLabels labels={labels} size="xs" />}
              </Stack>
              <Summary content={summary} error={error} />
            </Stack>
          </div>
          <div>
            <Stack direction="row" gap={1}>
              {/* if the rule is paused we don't care about the evaluation metadata */}
              {isPaused ? (
                <></>
              ) : (
                <EvaluationMetadata
                  lastEvaluation={lastEvaluation}
                  evaluationDuration={evaluationDuration}
                  evaluationInterval={evaluationInterval}
                  health={health}
                  error={error}
                />
              )}
              <MetaText icon="layer-group">
                <TextLink variant="bodySmall" color="secondary" href={href + '?tab=instances'} inline={false}>
                  {pluralize('instance', instancesCount, true)}
                </TextLink>
              </MetaText>

              {!isEmpty(labels) && (
                <MetaText icon="tag-alt">
                  <TextLink variant="bodySmall" color="secondary" href={href} inline={false}>
                    {pluralize('label', size(labels), true)}
                  </TextLink>
                </MetaText>
              )}
            </Stack>
          </div>
        </Stack>

        <Stack direction="row" alignItems="center" gap={1} wrap="nowrap">
          <Button
            variant="secondary"
            size="sm"
            icon="pen"
            type="button"
            disabled={isProvisioned}
            aria-label="edit-rule-action"
            data-testid="edit-rule-action"
          >
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

interface RecordingRuleListItemProps {
  name: string;
  href: string;
  error?: string;
  health?: RuleHealth;
  labels?: Labels;
  isProvisioned?: boolean;
  lastEvaluation?: string;
  evaluationInterval?: string;
  evaluationDuration?: number;
}

export const RecordingRuleListItem = ({
  name,
  error,
  health,
  isProvisioned,
  href,
  labels,
  lastEvaluation,
  evaluationInterval,
  // evaluation duration is always in seconds
  evaluationDuration,
}: RecordingRuleListItemProps) => {
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack direction="row" alignItems="start" gap={1} flex="1">
          <RuleListIcon health={health} recording={true} />
          <Stack direction="column" gap={0.5}>
            <Stack direction="column" gap={0}>
              <Stack direction="row" alignItems="start">
                <TextLink href={href} variant="body" weight="bold" inline={false}>
                  {name}
                </TextLink>
                {labels && <AlertLabels labels={labels} size="xs" />}
              </Stack>
              <Summary error={error} />
            </Stack>
            <div>
              <Stack direction="row" gap={1}>
                <EvaluationMetadata
                  lastEvaluation={lastEvaluation}
                  evaluationDuration={evaluationDuration}
                  evaluationInterval={evaluationInterval}
                  health={health}
                  error={error}
                />
                {!isEmpty(labels) && (
                  <MetaText icon="tag-alt">
                    <TextLink variant="bodySmall" color="secondary" href={href} inline={false}>
                      {pluralize('label', size(labels), true)}
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
            aria-label="edit-rule-action"
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
  evaluationDuration?: number; // in seconds
  evaluationInterval?: string;
  state?: PromAlertingRuleState;
  health?: RuleHealth;
  error?: string; // if health is "error" this should have error details for us
}

function EvaluationMetadata({
  lastEvaluation,
  evaluationDuration,
  evaluationInterval,
  state,
}: EvaluationMetadataProps) {
  const relativeEvaluationTime = getRelativeEvaluationInterval(evaluationInterval, lastEvaluation);

  // @TODO this component doesn't support millis so it just shows "0s" – might want to make it support millis
  const evaluationDurationString = evaluationDuration
    ? Time({ timeInMs: evaluationDuration * 1000, humanize: true })
    : null;

  const nextEvaluation = calculateNextEvaluationEstimate(lastEvaluation, evaluationInterval);

  if (state === PromAlertingRuleState.Firing && evaluationDurationString) {
    // @TODO support firing for calculation
    const firingFor = '2m 34s';

    return (
      <MetaText icon="clock-nine">
        Firing for <Text weight="bold">{firingFor}</Text>⋅ took {evaluationDurationString}
        {nextEvaluation && (
          <>
            {' '}
            ⋅ next evaluation in <Text weight="bold">{nextEvaluation.humanized}</Text>
          </>
        )}
      </MetaText>
    );
  }

  // for recording rules and normal or pending state alert rules we just show when we evaluated last and how long that took
  if (relativeEvaluationTime && evaluationDurationString) {
    return (
      <MetaText icon="clock-nine">
        Last evaluation <Text weight="bold">{relativeEvaluationTime}</Text>ago ⋅ took{' '}
        <Text weight="bold">{evaluationDurationString}</Text>
        {nextEvaluation && (
          <>
            {' '}
            ⋅ next evaluation <Text weight="bold">{nextEvaluation.humanized}</Text>
          </>
        )}
      </MetaText>
    );
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  alertListItemContainer: css({
    position: 'relative',
    listStyle: 'none',
    background: theme.colors.background.primary,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
  }),
});

interface RuleListIconProps {
  recording?: boolean;
  state?: PromAlertingRuleState;
  health?: RuleHealth;
  isPaused?: boolean;
}

/**
 * Make sure that the order of importance here matches the one we use in the StateBadge component for the detail view
 */
export function RuleListIcon({ state, health, recording = false, isPaused = false }: RuleListIconProps) {
  const icons: Record<PromAlertingRuleState, IconName> = {
    [PromAlertingRuleState.Inactive]: 'check-circle',
    [PromAlertingRuleState.Pending]: 'circle',
    [PromAlertingRuleState.Firing]: 'exclamation-circle',
  };

  const color: Record<PromAlertingRuleState, 'success' | 'error' | 'warning'> = {
    [PromAlertingRuleState.Inactive]: 'success',
    [PromAlertingRuleState.Pending]: 'warning',
    [PromAlertingRuleState.Firing]: 'error',
  };

  const stateNames: Record<PromAlertingRuleState, string> = {
    [PromAlertingRuleState.Inactive]: 'Normal',
    [PromAlertingRuleState.Pending]: 'Pending',
    [PromAlertingRuleState.Firing]: 'Firing',
  };

  let iconName: IconName = state ? icons[state] : 'circle';
  let iconColor: TextProps['color'] = state ? color[state] : 'secondary';
  let stateName: string = state ? stateNames[state] : 'unknown';

  if (recording) {
    iconName = 'record-audio';
    iconColor = 'success';
    stateName = 'Recording';
  }

  if (health === 'nodata') {
    iconName = 'exclamation-triangle';
    iconColor = 'warning';
    stateName = 'Insufficient data';
  }

  if (isErrorHealth(health)) {
    iconName = 'times-circle';
    iconColor = 'error';
    stateName = 'Failed to evaluate rule';
  }

  if (isPaused) {
    iconName = 'pause-circle';
    iconColor = 'warning';
    stateName = 'Paused';
  }

  return (
    <Tooltip content={stateName} placement="right">
      <div>
        <Text color={iconColor}>
          <Icon name={iconName} size="lg" />
        </Text>
      </div>
    </Tooltip>
  );
}
