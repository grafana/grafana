import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Stack, Text, Icon, TextLink, Dropdown, Button, Menu, Tooltip } from '@grafana/ui';
import { RuleHealth } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { MetaText } from '../MetaText';
import { Spacer } from '../Spacer';
import { StateBadge } from '../rule-viewer/StateBadges';

interface AlertRuleListItemProps {
  name: string;
  href: string;
  summary?: string;
  error?: string;
  state?: PromAlertingRuleState;
  health?: RuleHealth;
  isProvisioned?: boolean;
}

export const AlertRuleListItem = (props: AlertRuleListItemProps) => {
  const { name, summary, state, health, error, href, isProvisioned } = props;
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems="start" gap={1} wrap="nowrap">
        {state && <StateBadge state={state} health={health} includeState={false} />}
        <Stack direction="column" gap={0.5} flex="1">
          <div>
            <Stack direction="column" gap={0}>
              <TextLink href={href}>{name}</TextLink>
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
                          <Icon name="exclamation-circle" /> Last delivery attempt failed
                        </span>
                      </Tooltip>
                    </Stack>
                  </Text>
                </>
              ) : (
                <>
                  <MetaText icon="clock-nine">
                    Firing for <Text weight="bold">2m 34s</Text>
                  </MetaText>
                  <MetaText icon="hourglass">
                    Next evaluation in <Text weight="bold">34s</Text>
                  </MetaText>
                </>
              )}
            </Stack>
          </div>
        </Stack>

        <Stack direction="row" alignItems="center" gap={1} wrap="nowrap">
          <MetaText icon="layer-group">9</MetaText>
          <Button
            variant="secondary"
            size="sm"
            icon="edit"
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
            <Button
              variant="secondary"
              size="sm"
              icon="ellipsis-h"
              type="button"
              aria-label="more-rule-actions"
              data-testid="more-rule-actions"
            />
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
  isProvisioned?: boolean;
}

export const RecordingRuleListItem = ({ name, error, isProvisioned, href }: RecordingRuleListItemProps) => {
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems={'center'} gap={1}>
        <Icon name="record-audio" size="lg" />
        <Stack direction="row" alignItems={'center'} gap={1} flex="1">
          <Stack direction="column" gap={0.5}>
            <div>
              <Stack direction="column" gap={0}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <TextLink href={href} variant="body" weight="bold">
                    {name}
                  </TextLink>
                </Stack>
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
                            <Icon name="exclamation-circle" /> Last delivery attempt failed
                          </span>
                        </Tooltip>
                      </Stack>
                    </Text>
                  </>
                ) : (
                  <></>
                )}
              </Stack>
            </div>
          </Stack>
          <Spacer />
          <Button
            variant="secondary"
            size="sm"
            icon="edit"
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
            <Button
              variant="secondary"
              size="sm"
              icon="ellipsis-h"
              type="button"
              aria-label="more-rule-actions"
              data-testid="more-rule-actions"
            />
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
