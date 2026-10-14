import { useId } from 'react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { Input } from '@grafana/ui';

import { FilterSidebar, type SidebarControl } from '../rule-search/FilterSidebar';
import { type Criteria } from '../rule-search/criteria';
import { type CriteriaIssue } from '../rule-search/criteriaIssues';
import {
  HealthField,
  InvalidTokenNote,
  LabelMatchersEditor,
  RuleTitleField,
  SwitchField,
} from '../rule-search/filterSidebarPrimitives';
import { DataSourceMultiFilter, FolderMultiFilter } from '../rule-search/multiValueFilters';
import { recordingTokens } from '../rule-search/recordingTokens';
import { TOKEN_KEYS } from '../rule-search/tokens';

export interface RecordingRulesFilterSidebarProps {
  criteria: Criteria;
  onChange: (criteria: Criteria) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  issues?: CriteriaIssue[];
}

/** Persistent filter sidebar for the Recording rules page — same mechanics as the Alert
 * sidebar, with recorded-metric/target-data-source in place of the Alert-only routing and
 * paused controls (Recording-rule paused isn't exposed, per the New filter scope). */
export function RecordingRulesFilterSidebar({
  criteria,
  onChange,
  onClear,
  hasActiveFilters,
  issues = [],
}: RecordingRulesFilterSidebarProps) {
  const folderPickerId = useId();
  const targetDataSourcePickerId = useId();
  const invalidNamespace = issues.some((issue) => issue.key === 'namespace');
  const invalidDataSource = issues.some((issue) => issue.key === 'datasource');

  const controls: Record<string, SidebarControl> = {
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
    [TOKEN_KEYS.metric]: {
      render: () => (
        <Input
          aria-label={t('alerting.gma-rule-list.search.property.metric', 'Recorded metric')}
          placeholder={t('alerting.gma-rule-list.search.metric-placeholder', 'Metric name (exact match)')}
          value={criteria.metric ?? ''}
          onChange={(e) => onChange({ ...criteria, metric: e.currentTarget.value || undefined })}
        />
      ),
    },
    [TOKEN_KEYS.targetDatasource]: {
      render: () => (
        <DataSourcePicker
          inputId={targetDataSourcePickerId}
          current={criteria.targetDataSourceUid}
          noDefault
          onClear={() => onChange({ ...criteria, targetDataSourceUid: undefined })}
          onChange={(ds: DataSourceInstanceSettings) => onChange({ ...criteria, targetDataSourceUid: ds.uid })}
        />
      ),
    },
    [TOKEN_KEYS.health]: {
      render: () => <HealthField value={criteria.health} onChange={(health) => onChange({ ...criteria, health })} />,
    },
  };

  return (
    <FilterSidebar
      definitions={recordingTokens}
      controls={controls}
      onClear={onClear}
      hasActiveFilters={hasActiveFilters}
    />
  );
}
