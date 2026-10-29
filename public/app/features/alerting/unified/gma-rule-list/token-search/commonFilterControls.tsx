import { useId } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

import { type SidebarControl } from './FilterSidebar';
import { type FilterIssue } from './filterIssues';
import {
  HealthField,
  InvalidTokenNote,
  LabelMatchersEditor,
  RuleTitleField,
  SwitchField,
} from './filterSidebarPrimitives';
import { DataSourceMultiFilter, FolderMultiFilter } from './multiValueFilters';
import { type RuleSearchFilter } from './ruleSearchFilter';
import { TOKEN_KEYS } from './tokens';

export function useCommonFilterControls(
  filter: RuleSearchFilter,
  onChange: (filter: RuleSearchFilter) => void,
  issues: FilterIssue[]
): Record<string, SidebarControl> {
  const folderPickerId = useId();
  const invalidNamespace = hasIssue(issues, 'namespace');
  const invalidDataSource = hasIssue(issues, 'datasource');

  return {
    [TOKEN_KEYS.rule]: { render: () => <RuleTitleField filter={filter} onChange={onChange} /> },
    [TOKEN_KEYS.label]: {
      render: () => (
        <LabelMatchersEditor labels={filter.labels} onChange={(labels) => onChange({ ...filter, labels })} />
      ),
    },
    [TOKEN_KEYS.namespace]: {
      controlId: folderPickerId,
      note: (
        <Stack direction="column" gap={0.5}>
          {invalidNamespace && <InvalidTokenNote />}
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.gma-rule-list.search.folder-direct-hint">Rules directly in this folder</Trans>
          </Text>
        </Stack>
      ),
      render: () => (
        <FolderMultiFilter
          id={folderPickerId}
          values={filter.namespaces}
          invalid={invalidNamespace}
          onChange={(namespaces) => onChange({ ...filter, namespaces })}
        />
      ),
    },
    [TOKEN_KEYS.datasource]: {
      note: invalidDataSource && <InvalidTokenNote />,
      render: () => (
        <DataSourceMultiFilter
          values={filter.dataSourceUids}
          invalid={invalidDataSource}
          onChange={(dataSourceUids) => onChange({ ...filter, dataSourceUids })}
        />
      ),
    },
    [TOKEN_KEYS.plugins]: {
      render: () => (
        <SwitchField
          label={t('alerting.gma-rule-list.token-search.property.hide-plugin-rules', 'Hide plugin rules')}
          value={filter.hidePluginRules}
          onChange={(hidePluginRules) => onChange({ ...filter, hidePluginRules })}
        />
      ),
    },
    [TOKEN_KEYS.health]: {
      render: () => <HealthField value={filter.health} onChange={(health) => onChange({ ...filter, health })} />,
    },
  };
}

function hasIssue(issues: FilterIssue[], key: string): boolean {
  return issues.some((issue) => issue.key === key);
}
