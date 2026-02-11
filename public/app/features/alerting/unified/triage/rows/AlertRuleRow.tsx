import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

import { MetaText } from '../../components/MetaText';
import { RuleDetailsDrawer } from '../rule-details/RuleDetailsDrawer';
import { AlertRuleInstances } from '../scene/AlertRuleInstances';
import { AlertRuleSummary } from '../scene/AlertRuleSummary';
import { AlertRuleRow as AlertRuleRowType } from '../types';

import { GenericRow } from './GenericRow';
import { RowActions } from './InstanceCountBadges';
import { OpenDrawerButton } from './OpenDrawerButton';

interface AlertRuleRowProps {
  row: AlertRuleRowType;
  leftColumnWidth: number;
  rowKey: React.Key;
  depth?: number;
  enableFolderMeta?: boolean;
}

export const AlertRuleRow = ({
  row,
  leftColumnWidth,
  rowKey,
  depth = 0,
  enableFolderMeta = true,
}: AlertRuleRowProps) => {
  const { ruleUID, folder, title } = row.metadata;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleDrawerOpen = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  return (
    <>
      <GenericRow
        key={rowKey}
        width={leftColumnWidth}
        title={<Text variant="body">{title}</Text>}
        actions={
          <RowActions
            counts={row.instanceCounts}
            actionButton={
              <OpenDrawerButton
                aria-label={t('alerting.triage.open-rule-details', 'Open rule details')}
                onClick={handleDrawerOpen}
              />
            }
          />
        }
        metadata={
          enableFolderMeta ? (
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
