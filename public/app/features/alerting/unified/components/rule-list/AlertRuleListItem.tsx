import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import pluralize from 'pluralize';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Stack, Text, TextLink, Dropdown, Button, Menu } from '@grafana/ui';
import { RuleHealth } from 'app/types/unified-alerting';
import { Labels, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { labelsSize } from '../../utils/labels';
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
                {/* {labels && <AlertLabels labels={labels} size="xs" />} */}
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
                  evaluationInterval={evaluationInterval}
                  health={health}
                  state={state}
                  error={error}
                />
              )}
              {!isPaused && (
                <>
                  <MetaText icon="layer-group">
                    <TextLink variant="bodySmall" color="secondary" href={href + '?tab=instances'} inline={false}>
                      {pluralize('instance', instancesCount, true)}
                    </TextLink>
                  </MetaText>

                  {!isEmpty(labels) && (
                    <MetaText icon="tag-alt">
                      <TextLink variant="bodySmall" color="secondary" href={href} inline={false}>
                        {pluralize('label', labelsSize(labels), true)}
                      </TextLink>
                    </MetaText>
                  )}
                </>
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

interface RecordingRuleListItemProps {
  name: string;
  href: string;
  error?: string;
  health?: RuleHealth;
  state?: PromAlertingRuleState;
  labels?: Labels;
  isProvisioned?: boolean;
  lastEvaluation?: string;
  evaluationInterval?: string;
  evaluationDuration?: number;
}

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
          <RuleListIcon health={health} recording={true} />
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
                    <TextLink variant="bodySmall" color="secondary" href={href} inline={false}>
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
        Firing for <Text weight="bold">{firingFor}</Text>
        {nextEvaluation && <>· next evaluation in {nextEvaluation.humanized}</>}
      </MetaText>
    );
  }

  // for recording rules and normal or pending state alert rules we just show when we evaluated last and how long that took
  if (nextEvaluation) {
    return (
      <MetaText icon="clock-nine">
        Next evaluation <Text weight="bold">{nextEvaluation.humanized}</Text>
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
