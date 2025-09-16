import { useState } from 'react';

import { t } from '@grafana/i18n';
import { IconButton, Stack, Text, TextLink } from '@grafana/ui';

import { MetaText } from '../../components/MetaText';
import { WithReturnButton } from '../../components/WithReturnButton';
import { rulesNav } from '../../utils/navigation';
import { RuleDetailsDrawer } from '../rule-details/RuleDetailsDrawer';
import { AlertRuleInstances } from '../scene/AlertRuleInstances';
import { AlertRuleSummary } from '../scene/AlertRuleSummary';
import { AlertRuleRow as AlertRuleRowType } from '../types';

import { GenericRow } from './GenericRow';

interface AlertRuleRowProps {
  row: AlertRuleRowType;
  leftColumnWidth: number;
  rowKey: React.Key;
  depth?: number;
}

export const AlertRuleRow = ({ row, leftColumnWidth, rowKey, depth = 0 }: AlertRuleRowProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleDrawerOpen = () => {
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  return (
    <>
      <GenericRow
        key={rowKey}
        width={leftColumnWidth}
        title={
          <WithReturnButton
            component={
              <TextLink
                inline={false}
                href={rulesNav.detailsPageLink('grafana', {
                  ruleSourceName: 'grafana',
                  uid: row.metadata.ruleUID,
                })}
              >
                {row.metadata.title}
              </TextLink>
            }
          />
        }
        metadata={
          <Stack direction="row" gap={0.5} alignItems="center">
            <MetaText icon="folder" />
            <Text variant="bodySmall" color="secondary">
              {row.metadata.folder}
            </Text>
          </Stack>
        }
        actions={
          <IconButton
            style={{ transform: 'rotate(180deg)' }}
            name="web-section-alt"
            aria-label={t('alerting.triage.open-in-sidebar', 'Open in sidebar')}
            onClick={handleDrawerOpen}
          />
        }
        content={<AlertRuleSummary ruleUID={row.metadata.ruleUID} />}
        depth={depth}
      >
        <AlertRuleInstances ruleUID={row.metadata.ruleUID} depth={depth + 1} />
      </GenericRow>

      {isDrawerOpen && <RuleDetailsDrawer ruleUID={row.metadata.ruleUID} onClose={handleDrawerClose} />}
    </>
  );
};
