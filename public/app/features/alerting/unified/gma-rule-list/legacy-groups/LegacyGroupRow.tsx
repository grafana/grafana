import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Badge, Box, Button, Icon, IconButton, Stack, Text } from '@grafana/ui';
import { type GrafanaPromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { isProvisionedResource } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';
import { formatPrometheusDuration } from '../../utils/time';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleRowList } from '../rule-row/RuleRowList';

import { LegacyGroupRuleRow } from './LegacyGroupRuleRow';

interface LegacyGroupRowProps {
  group: GrafanaPromRuleGroupDTO;
  onConvert: () => void;
}

export function LegacyGroupRow({ group, onConvert }: LegacyGroupRowProps) {
  const [showRules, setShowRules] = useState(false);
  const recordingCount = group.rules.filter((rule) => rule.type === PromRuleType.Recording).length;
  const alertCount = group.rules.length - recordingCount;
  const allRules = group.rules.length;
  // Each rule counted once, plugin first, as its origin badge shows it.
  const pluginCount = group.rules.filter((rule) => getRulePluginOrigin({ labels: rule.labels })).length;
  const provisionedCount = group.rules.filter(
    (rule) => !getRulePluginOrigin({ labels: rule.labels }) && isProvisionedResource(rule.provenance)
  ).length;
  const notConvertible = notConvertibleReason(allRules, pluginCount, provisionedCount);
  const interval = formatPrometheusDuration(group.interval * 1000);

  return (
    <>
      <RuleListItem
        icon={
          <IconButton
            name={showRules ? 'angle-down' : 'angle-right'}
            aria-expanded={showRules}
            aria-label={
              showRules
                ? t('alerting.gma-rule-list.legacy-groups.hide-rules', 'Hide rules in {{group}}', {
                    group: group.name,
                    interpolation: { escapeValue: false },
                  })
                : t('alerting.gma-rule-list.legacy-groups.show-rules', 'Show rules in {{group}}', {
                    group: group.name,
                    interpolation: { escapeValue: false },
                  })
            }
            onClick={() => setShowRules(!showRules)}
          />
        }
        title={
          <Stack direction="row" alignItems="center" gap={1}>
            <Icon name="layer-group" />
            <Text>{group.name}</Text>
          </Stack>
        }
        meta={[
          <Text key="interval" color="secondary" variant="bodySmall">
            {t('alerting.gma-rule-list.legacy-groups.group-interval', 'Every {{interval}}', {
              interval,
            })}
          </Text>,
          alertCount > 0 && (
            <Text key="alert" color="secondary" variant="bodySmall">
              {t('alerting.gma-rule-list.legacy-groups.alert-count', '', {
                count: alertCount,
                defaultValue_one: '{{count}} alert rule',
                defaultValue_other: '{{count}} alert rules',
              })}
            </Text>
          ),
          recordingCount > 0 && (
            <Text key="recording" color="secondary" variant="bodySmall">
              {t('alerting.gma-rule-list.legacy-groups.recording-count', '', {
                count: recordingCount,
                defaultValue_one: '{{count}} recording rule',
                defaultValue_other: '{{count}} recording rules',
              })}
            </Text>
          ),
        ]}
        right={
          <>
            {provisionedCount > 0 && (
              <Badge
                color="purple"
                text={
                  provisionedCount === allRules
                    ? t('alerting.gma-rule-list.legacy-groups.provisioned', 'Provisioned')
                    : t('alerting.gma-rule-list.legacy-groups.some-provisioned', '', {
                        count: provisionedCount,
                        defaultValue_one: '{{count}} provisioned',
                        defaultValue_other: '{{count}} provisioned',
                      })
                }
              />
            )}
            {pluginCount > 0 && (
              <Badge
                color="blue"
                text={
                  pluginCount === allRules
                    ? t('alerting.gma-rule-list.legacy-groups.plugin-managed', 'Plugin')
                    : t('alerting.gma-rule-list.legacy-groups.some-plugin-managed', '', {
                        count: pluginCount,
                        defaultValue_one: '{{count}} plugin-managed',
                        defaultValue_other: '{{count}} plugin-managed',
                      })
                }
              />
            )}
            <Button
              size="sm"
              variant="secondary"
              icon="folder-plus"
              onClick={onConvert}
              disabled={Boolean(notConvertible)}
              tooltip={notConvertible}
              aria-label={t(
                'alerting.gma-rule-list.legacy-groups.convert-button-label',
                'Convert {{group}} to subfolder',
                {
                  group: group.name,
                  interpolation: { escapeValue: false },
                }
              )}
            >
              <Trans i18nKey="alerting.gma-rule-list.legacy-groups.convert-button">Convert to subfolder</Trans>
            </Button>
          </>
        }
      />
      {showRules && (
        <li>
          <Box paddingLeft={5}>
            <RuleRowList
              aria-label={t('alerting.gma-rule-list.legacy-groups.rules-in', 'Rules in {{group}}', {
                group: group.name,
                interpolation: { escapeValue: false },
              })}
            >
              {group.rules.map((rule) => (
                <LegacyGroupRuleRow key={rule.uid} rule={rule} interval={interval} />
              ))}
            </RuleRowList>
          </Box>
        </li>
      )}
    </>
  );
}

/** Why the group can't be converted here: its provisioning setup or plugin owns the grouping. */
function notConvertibleReason(allRules: number, pluginCount: number, provisionedCount: number): string | undefined {
  if (pluginCount === allRules) {
    return t(
      'alerting.gma-rule-list.legacy-groups.plugin-tooltip',
      'Converting groups managed by a plugin isn’t supported. The plugin manages their grouping.'
    );
  }
  if (pluginCount + provisionedCount === allRules) {
    return t(
      'alerting.gma-rule-list.legacy-groups.provisioned-tooltip',
      'Converting provisioned groups isn’t supported. Change the grouping in your provisioning setup.'
    );
  }
  return undefined;
}
