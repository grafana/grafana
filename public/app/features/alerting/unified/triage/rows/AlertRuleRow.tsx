import { urlUtil } from '@grafana/data';
import { useLocationService } from '@grafana/runtime';
import { Stack, Text, TextLink } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { MetaText } from '../../components/MetaText';
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
  const [queryParams] = useQueryParams();
  const { getLocation } = useLocationService();

  const { ruleUID, folder, title } = row.metadata;

  const currentLocation = getLocation();
  const hrefWithRuleUID = urlUtil.renderUrl(currentLocation.pathname, { ...queryParams, ruleUID });

  return (
    <GenericRow
      key={rowKey}
      width={leftColumnWidth}
      title={
        <TextLink inline={false} href={hrefWithRuleUID}>
          {title}
        </TextLink>
      }
      metadata={
        <Stack direction="row" gap={0.5} alignItems="center">
          <MetaText icon="folder" />
          <Text variant="bodySmall" color="secondary">
            {folder}
          </Text>
        </Stack>
      }
      content={<AlertRuleSummary ruleUID={ruleUID} />}
      depth={depth}
    >
      <AlertRuleInstances ruleUID={ruleUID} depth={depth + 1} />
    </GenericRow>
  );
};
