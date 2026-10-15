import { useId } from 'react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { Input } from '@grafana/ui';

import { FilterSidebar, type SidebarControl } from '../rule-search/FilterSidebar';
import { useCommonFilterControls } from '../rule-search/commonFilterControls';
import { type Criteria } from '../rule-search/criteria';
import { type CriteriaIssue } from '../rule-search/criteriaIssues';
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
  const commonControls = useCommonFilterControls(criteria, onChange, issues);
  const targetDataSourcePickerId = useId();

  const controls: Record<string, SidebarControl> = {
    ...commonControls,
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
