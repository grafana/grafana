import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns';
import { isEmpty, size } from 'lodash';
import pluralize from 'pluralize';
import React from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { useStyles2, Stack, Text, Icon, TextLink, Dropdown, Button, Menu, Tooltip } from '@grafana/ui';
import { TextProps } from '@grafana/ui/src/components/Text/Text';
import { RuleHealth } from 'app/types/unified-alerting';
import { Labels, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { formatPrometheusDuration } from '../../utils/time';
import { AlertLabels } from '../AlertLabels';
import { MetaText } from '../MetaText';
import MoreButton from '../MoreButton';
import { Spacer } from '../Spacer';
import { isErrorHealth } from '../rule-viewer/RuleViewer';

interface AlertRuleListItemProps {
  name: string;
  href: string;
  summary?: string;
  error?: string;
  state?: PromAlertingRuleState;
  isPaused?: boolean;
  health?: RuleHealth;
  isProvisioned?: boolean;
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
              <Stack direction="row" gap={0.5} alignItems="start">
                <TextLink href={href} inline={false}>
                  {name}
                </TextLink>
                {labels && <AlertLabels labels={labels} size="xs" />}
              </Stack>
              {summary && (
                <Text variant="bodySmall" color="secondary">
                  {summary}
                </Text>
              )}
            </Stack>
          </div>
          <div>
            <Stack direction="row" gap={1}>
              {error ? (
                <>
                  {/* TODO we might need an error variant for MetaText, dito for success */}
                  {/* TODO show error details on hover or elsewhere */}
                  <Text color="error" variant="bodySmall" weight="bold">
                    <Stack direction="row" alignItems={'center'} gap={0.5}>
                      <Tooltip
                        content={
                          'failed to send notification to email addresses: gilles.demey@grafana.com: dial tcp 192.168.1.21:1025: connect: connection refused'
                        }
                      >
                        <span>
                          <Icon name="exclamation-circle" size="sm" /> Last delivery attempt failed
                        </span>
                      </Tooltip>
                    </Stack>
                  </Text>
                </>
              ) : (
                <>
                  <MetaText icon="clock-nine">
                    Firing for <Text weight="bold">2m 34s</Text>⋅ next evaluation in <Text weight="bold">34s</Text>
                  </MetaText>
                </>
              )}
              <MetaText icon="layer-group">
                <TextLink variant="bodySmall" color="secondary" href={href + '?tab=instances'} inline={false}>
                  {pluralize('instance', instancesCount, true)}
                </TextLink>
              </MetaText>

              {!isEmpty(labels) && (
                <MetaText icon="tag">
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

interface RecordingRuleListItemProps {
  name: string;
  href: string;
  error?: string;
  health?: RuleHealth;
  labels?: Labels;
  isProvisioned?: boolean;
  lastEvaluation?: string;
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
  // evaluation duration is always in seconds
  evaluationDuration,
}: RecordingRuleListItemProps) => {
  const styles = useStyles2(getStyles);

  const relativeEvaluationTime = lastEvaluation ? formatDistanceToNowStrict(new Date(lastEvaluation)) : null;
  const evaluationDurationString = evaluationDuration
    ? formatPrometheusDuration(Math.round(evaluationDuration * 1000))
    : null;

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack direction="row" alignItems="start" gap={1} flex="1">
          <RuleListIcon health={health} recording={true} />
          <Stack direction="column" gap={0.5}>
            <Stack direction="row" gap={0.5} alignItems="start">
              <TextLink href={href} variant="body" weight="bold" inline={false}>
                {name}
              </TextLink>
              {labels && <AlertLabels labels={labels} size="xs" />}
            </Stack>
            <div>
              <Stack direction="row" gap={1}>
                {error ? (
                  <>
                    {/* TODO we might need an error variant for MetaText, dito for success */}
                    {/* TODO show error details on hover or elsewhere */}
                    <Text color="error" variant="bodySmall" weight="bold">
                      <Stack direction="row" alignItems={'center'} gap={0.5}>
                        <Tooltip
                          content={
                            'failed to send notification to email addresses: gilles.demey@grafana.com: dial tcp 192.168.1.21:1025: connect: connection refused'
                          }
                        >
                          <span>
                            <Icon name="exclamation-circle" /> Last delivery attempt failed
                          </span>
                        </Tooltip>
                      </Stack>
                    </Text>
                  </>
                ) : (
                  <>
                    {relativeEvaluationTime && evaluationDurationString && (
                      <MetaText icon="clock-nine">
                        Last evaluation <Text weight="bold">{relativeEvaluationTime}</Text>ago ⋅ took{' '}
                        <Text weight="bold">{evaluationDurationString}</Text>
                      </MetaText>
                    )}
                    {!isEmpty(labels) && (
                      <MetaText icon="tag">
                        <TextLink variant="bodySmall" color="secondary" href={href} inline={false}>
                          {pluralize('label', size(labels), true)}
                        </TextLink>
                      </MetaText>
                    )}
                  </>
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
