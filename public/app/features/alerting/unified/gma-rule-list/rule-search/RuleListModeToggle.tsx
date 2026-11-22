import { useId } from 'react';

import { t } from '@grafana/i18n';
import { Box, RadioButtonGroup, Tooltip } from '@grafana/ui';

import { type RuleListMode } from './useRuleListSearchState';

interface RuleListModeToggleProps {
  mode: RuleListMode;
  onChange: (mode: RuleListMode) => void;
  foldersDisabled: boolean;
}

export function RuleListModeToggle({ mode, onChange, foldersDisabled }: RuleListModeToggleProps) {
  const hintId = useId();
  const hint = t('alerting.gma-rule-list.search.folders-disabled', 'Clear filters to browse by folder');

  const toggle = (
    <RadioButtonGroup
      aria-label={t('alerting.gma-rule-list.search.view', 'View')}
      aria-describedby={foldersDisabled ? hintId : undefined}
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

  // A disabled radio fires no pointer events, so the tooltip hangs off a wrapper around the group. The hover-only
  // tooltip is repeated as hidden text for assistive technology.
  return (
    <Tooltip content={hint}>
      <Box>
        {toggle}
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      </Box>
    </Tooltip>
  );
}
