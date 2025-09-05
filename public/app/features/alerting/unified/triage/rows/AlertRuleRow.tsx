import React from 'react';

import { Stack, Text, TextLink } from '@grafana/ui';

import { MetaText } from '../../components/MetaText';
import { AlertRuleInstances } from '../scene/AlertRuleInstances';
import { AlertRuleSummary } from '../scene/AlertRuleSummary';
import { AlertRuleRow as AlertRuleRowType } from '../types';

import { GenericRow } from './GenericRow';

interface AlertRuleRowProps {
  row: AlertRuleRowType;
  leftColumnWidth: number;
  rowKey: React.Key;
}

export const AlertRuleRow = ({ row, leftColumnWidth, rowKey }: AlertRuleRowProps) => {
  return (
    <GenericRow
      key={rowKey}
      width={leftColumnWidth}
      title={
        <TextLink inline={false} href="#">
          {row.metadata.title}
        </TextLink>
      }
      metadata={
        <Stack direction="row" gap={0.5} alignItems="center">
          <MetaText icon="folder" />
          <Text variant="bodySmall" color="secondary">
            {row.metadata.folder}
          </Text>
        </Stack>
      }
      content={<AlertRuleSummary ruleUID={row.metadata.ruleUID} />}
    >
      <AlertRuleInstances ruleUID={row.metadata.ruleUID} />
    </GenericRow>
  );
};
