import { t } from '@grafana/i18n';
import { Box, RadioButtonGroup, Tooltip } from '@grafana/ui';

import { type RuleListMode } from './useRuleListSearchState';

export interface RuleListModeToggleProps {
  mode: RuleListMode;
  onChange: (mode: RuleListMode) => void;
  foldersDisabled: boolean;
}

export function RuleListModeToggle({ mode, onChange, foldersDisabled }: RuleListModeToggleProps) {
  const toggle = (
    <RadioButtonGroup
      value={mode}
      onChange={onChange}
      disabledOptions={foldersDisabled ? ['folders'] : undefined}
      options={[
        { icon: 'folder', label: t('alerting.gma-rule-list.search.view-folders', 'Folders'), value: 'folders' },
        { icon: 'list-ul', label: t('alerting.gma-rule-list.search.view-list', 'List'), value: 'list' },
      ]}
    />
  );

  if (!foldersDisabled) {
    return toggle;
  }

  // A disabled radio fires no pointer events, so the tooltip hangs off a wrapper around the group.
  return (
    <Tooltip content={t('alerting.gma-rule-list.search.folders-disabled', 'Clear filters to browse by folder')}>
      <Box>{toggle}</Box>
    </Tooltip>
  );
}
