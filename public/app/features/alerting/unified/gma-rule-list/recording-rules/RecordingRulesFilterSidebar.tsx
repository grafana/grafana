import { useId } from 'react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Input } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { FilterSidebar, type SidebarControl } from '../token-search/FilterSidebar';
import { useCommonFilterControls } from '../token-search/commonFilterControls';
import { type FilterIssue } from '../token-search/filterIssues';
import { recordingTokens } from '../token-search/recordingTokens';
import { type RuleSearchFilter } from '../token-search/ruleSearchFilter';
import { TOKEN_KEYS } from '../token-search/tokens';

export interface RecordingRulesFilterSidebarProps {
  filter: RuleSearchFilter;
  onChange: (filter: RuleSearchFilter) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  issues?: FilterIssue[];
}

export function RecordingRulesFilterSidebar({
  filter,
  onChange,
  onClear,
  hasActiveFilters,
  issues = [],
}: RecordingRulesFilterSidebarProps) {
  const commonControls = useCommonFilterControls(filter, onChange, issues);
  const targetDataSourcePickerId = useId();

  const controls: Record<string, SidebarControl> = {
    ...commonControls,
    [TOKEN_KEYS.metric]: {
      render: () => (
        <Input
          aria-label={t('alerting.gma-rule-list.search.property.metric', 'Recorded metric')}
          placeholder={t('alerting.gma-rule-list.search.metric-placeholder', 'Metric name (exact match)')}
          value={filter.metric ?? ''}
          onChange={(e) => onChange({ ...filter, metric: e.currentTarget.value || undefined })}
        />
      ),
    },
    [TOKEN_KEYS.targetDatasource]: {
      render: () => (
        <DataSourcePicker
          inputId={targetDataSourcePickerId}
          current={filter.targetDataSourceUid}
          noDefault
          onClear={() => onChange({ ...filter, targetDataSourceUid: undefined })}
          onChange={(ds: DataSourceInstanceSettings) => onChange({ ...filter, targetDataSourceUid: ds.uid })}
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
