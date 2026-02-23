import { t } from '@grafana/i18n';
import { Icon, Stack, TextLink, Tooltip } from '@grafana/ui';
import { RulesSourceIdentifier } from 'app/types/unified-alerting';
import { RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { isUngroupedRuleGroup } from '../../utils/rules';

import { DataSourceIcon } from './DataSourceIcon';

interface RuleLocationProps {
  namespace: string;
  group: string;
  groupUrl?: string;
  rulesSource?: RulesSourceIdentifier;
  application?: RulesSourceApplication;
}

export function RuleLocation({ namespace, group, groupUrl, rulesSource, application }: RuleLocationProps) {
  const isGrafanaApp = application === 'grafana';
  const isDataSourceApp = !!rulesSource && !!application && !isGrafanaApp;
  const groupText = isUngroupedRuleGroup(group) ? t('alerting.rules-group.ungrouped', 'Ungrouped') : group;

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {isGrafanaApp && <Icon size="xs" name="folder" />}
      {isDataSourceApp && (
        <Tooltip content={rulesSource.name}>
          <span>
            <DataSourceIcon application={application} size={14} />
          </span>
        </Tooltip>
      )}

      <Stack direction="row" alignItems="center" gap={0}>
        {namespace}
        <Icon size="sm" name="angle-right" />
        {groupUrl ? (
          <TextLink href={groupUrl} color="secondary" variant="bodySmall" inline={false}>
            {groupText}
          </TextLink>
        ) : (
          groupText
        )}
      </Stack>
    </Stack>
  );
}
