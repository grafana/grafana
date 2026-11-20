import { useId } from 'react';

import { useDataSourcesWithValidRecordingTarget } from '@grafana/alerting/internal';
import { t } from '@grafana/i18n';
import { Combobox, Divider, Stack } from '@grafana/ui';

import { SidebarField, SidebarSection } from '../../rule-list/filter/RulesFilterSidebar';
import {
  DataSourceFilter,
  FolderFilter,
  HealthFilter,
  PluginRulesFilter,
  TextFilter,
} from '../rule-search/FilterSidebar';
import { LabelMatchersFilter } from '../rule-search/LabelMatchersFilter';
import { setFilters } from '../rule-search/setFilterValues';
import { formatLabelMatcher } from '../rule-search/sharedFilters';

import { type RecordingFilterKey, type RecordingRuleFilter, recordingRuleSearchSchema } from './recordingRuleFilters';

interface RecordingRulesFilterSidebarProps {
  query: string;
  filter: RecordingRuleFilter;
  onApply: (query: string) => void;
}

export function RecordingRulesFilterSidebar({ query, filter, onApply }: RecordingRulesFilterSidebarProps) {
  const apply = (changes: Partial<Record<RecordingFilterKey, Array<string | undefined>>>) =>
    onApply(setFilters(query, recordingRuleSearchSchema, changes));

  return (
    <Stack direction="column" gap={2}>
      <SidebarSection>
        <TextFilter
          label={t('alerting.gma-rule-list.sidebar.rule-name', 'Rule name')}
          placeholder={t('alerting.gma-rule-list.sidebar.rule-name-placeholder', 'Filter by name')}
          value={filter.text.join(' ')}
          onApply={(text) => apply({ rule: [text] })}
        />
        <LabelMatchersFilter
          labels={filter.labels}
          onChange={(labels) => apply({ label: labels.map(formatLabelMatcher) })}
        />
      </SidebarSection>
      <Divider spacing={0} />
      <SidebarSection>
        <FolderFilter folderUids={filter.folderUids} onChange={(uids) => apply({ folderUid: uids })} />
        <DataSourceFilter dataSourceUids={filter.dataSourceUids} onChange={(uids) => apply({ datasource: uids })} />
      </SidebarSection>
      <Divider spacing={0} />
      <SidebarSection>
        <TextFilter
          label={t('alerting.gma-rule-list.sidebar.metric', 'Recorded metric')}
          placeholder={t('alerting.gma-rule-list.sidebar.metric-placeholder', 'Exact metric name')}
          value={filter.metric ?? ''}
          onApply={(metric) => apply({ metric: [metric.trim()] })}
        />
        <TargetDataSourceFilter
          dataSourceUid={filter.targetDataSourceUid}
          onChange={(uid) => apply({ targetDatasource: [uid] })}
        />
      </SidebarSection>
      <Divider spacing={0} />
      <HealthFilter health={filter.health} onChange={(health) => apply({ health: [health] })} />
      <Divider spacing={0} />
      <PluginRulesFilter
        hide={filter.hidePluginRules}
        onChange={(hide) => apply({ plugins: [hide ? 'hide' : undefined] })}
      />
    </Stack>
  );
}

function TargetDataSourceFilter({
  dataSourceUid,
  onChange,
}: {
  dataSourceUid: string | undefined;
  onChange: (uid: string | undefined) => void;
}) {
  const id = useId();
  const { items, isLoading } = useDataSourcesWithValidRecordingTarget();
  const options = items.map((ds) => ({ label: ds.name, value: ds.uid }));
  // A UID with no target behind it still shows, so it can be cleared.
  if (dataSourceUid && !options.some((option) => option.value === dataSourceUid)) {
    options.push({ label: dataSourceUid, value: dataSourceUid });
  }

  return (
    <SidebarField label={t('alerting.gma-rule-list.sidebar.target-datasource', 'Target data source')} htmlFor={id}>
      <Combobox
        id={id}
        loading={isLoading}
        options={options}
        value={dataSourceUid ?? null}
        isClearable
        placeholder={t('alerting.gma-rule-list.sidebar.target-datasource-placeholder', 'Select data source')}
        onChange={(option) => onChange(option?.value)}
      />
    </SidebarField>
  );
}
