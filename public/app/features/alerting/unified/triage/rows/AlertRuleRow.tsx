import { useState } from 'react';

import { t } from '@grafana/i18n';
import { IconButton, Stack, Text } from '@grafana/ui';

import { MetaText } from '../../components/MetaText';
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
  groupBy?: string[];
}

export const AlertRuleRow = ({ row, leftColumnWidth, rowKey, depth = 0, groupBy }: AlertRuleRowProps) => {
  const { ruleUID, folder, title } = row.metadata;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleDrawerOpen = () => {
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  // Hide folder metadata if grafana_folder is in the groupBy array
  const shouldShowFolderMetadata = !groupBy?.includes('grafana_folder');

  return (
    <>
      <GenericRow
        key={rowKey}
        width={leftColumnWidth}
        title={<Text variant="body">{title}</Text>}
        actions={
          <IconButton
            style={{ transform: 'rotate(180deg)' }}
            name="web-section-alt"
            aria-label={t('alerting.triage.open-rule-details', 'Open rule details')}
            onClick={handleDrawerOpen}
          />
        }
        metadata={
          shouldShowFolderMetadata ? (
            <Stack direction="row" gap={0.5} alignItems="center">
              <MetaText icon="folder" />
              <Text variant="bodySmall" color="secondary">
                {folder}
              </Text>
            </Stack>
          ) : undefined
        }
        content={<AlertRuleSummary ruleUID={ruleUID} />}
        depth={depth}
      >
        <AlertRuleInstances ruleUID={ruleUID} depth={depth + 1} />
      </GenericRow>

      {isDrawerOpen && <RuleDetailsDrawer ruleUID={ruleUID} onClose={handleDrawerClose} />}
    </>
  );
};
