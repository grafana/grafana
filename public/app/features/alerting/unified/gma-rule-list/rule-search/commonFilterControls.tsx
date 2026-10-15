import { useId } from 'react';

import { t } from '@grafana/i18n';

import { type SidebarControl } from './FilterSidebar';
import { type Criteria } from './criteria';
import { type CriteriaIssue } from './criteriaIssues';
import {
  HealthField,
  InvalidTokenNote,
  LabelMatchersEditor,
  RuleTitleField,
  SwitchField,
} from './filterSidebarPrimitives';
import { DataSourceMultiFilter, FolderMultiFilter } from './multiValueFilters';
import { TOKEN_KEYS } from './tokens';

/** The sidebar controls both the Alert and the Recording page have, by definition key. */
export function useCommonFilterControls(
  criteria: Criteria,
  onChange: (criteria: Criteria) => void,
  issues: CriteriaIssue[]
): Record<string, SidebarControl> {
  const folderPickerId = useId();
  const invalidNamespace = hasIssue(issues, 'namespace');
  const invalidDataSource = hasIssue(issues, 'datasource');

  return {
    [TOKEN_KEYS.rule]: { render: () => <RuleTitleField criteria={criteria} onChange={onChange} /> },
    [TOKEN_KEYS.label]: {
      render: () => (
        <LabelMatchersEditor labels={criteria.labels} onChange={(labels) => onChange({ ...criteria, labels })} />
      ),
    },
    [TOKEN_KEYS.namespace]: {
      controlId: folderPickerId,
      note: invalidNamespace && <InvalidTokenNote />,
      render: () => (
        <FolderMultiFilter
          id={folderPickerId}
          values={criteria.namespaces}
          invalid={invalidNamespace}
          onChange={(namespaces) => onChange({ ...criteria, namespaces })}
        />
      ),
    },
    [TOKEN_KEYS.datasource]: {
      note: invalidDataSource && <InvalidTokenNote />,
      render: () => (
        <DataSourceMultiFilter
          values={criteria.dataSourceUids}
          invalid={invalidDataSource}
          onChange={(dataSourceUids) => onChange({ ...criteria, dataSourceUids })}
        />
      ),
    },
    [TOKEN_KEYS.plugins]: {
      render: () => (
        <SwitchField
          label={t('alerting.gma-rule-list.search.property.hide-plugin-rules', 'Hide plugin rules')}
          value={criteria.hidePluginRules}
          onChange={(hidePluginRules) => onChange({ ...criteria, hidePluginRules })}
        />
      ),
    },
    [TOKEN_KEYS.health]: {
      render: () => <HealthField value={criteria.health} onChange={(health) => onChange({ ...criteria, health })} />,
    },
  };
}

function hasIssue(issues: CriteriaIssue[], key: string): boolean {
  return issues.some((issue) => issue.key === key);
}
