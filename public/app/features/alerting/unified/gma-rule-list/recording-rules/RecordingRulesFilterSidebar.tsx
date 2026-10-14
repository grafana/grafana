import { type DataSourceInstanceSettings } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, Input, Stack } from '@grafana/ui';

import { type Criteria } from '../rule-search/criteria';
import { type CriteriaIssue } from '../rule-search/criteriaIssues';
import {
  FilterSidebarContainer,
  HealthField,
  InvalidTokenNote,
  LabelMatchersEditor,
  RuleTitleField,
  SidebarField,
  SidebarSection,
  SwitchField,
} from '../rule-search/filterSidebarPrimitives';
import { DataSourceMultiFilter, FolderMultiFilter } from '../rule-search/multiValueFilters';

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
  const invalidNamespace = issues.some((issue) => issue.key === 'namespace');
  const invalidDataSource = issues.some((issue) => issue.key === 'datasource');

  return (
    <FilterSidebarContainer>
      <Stack direction="column" gap={0}>
        <Stack direction="row" justifyContent="flex-end">
          <Button size="sm" variant="primary" fill="text" onClick={onClear} disabled={!hasActiveFilters}>
            <Trans i18nKey="alerting.gma-rule-list.search.clear-filters">Clear filters</Trans>
          </Button>
        </Stack>
        <Stack direction="column" gap={2}>
          <SidebarSection>
            <RuleTitleField criteria={criteria} onChange={onChange} />
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.labels">Labels</Trans>}>
              <LabelMatchersEditor labels={criteria.labels} onChange={(labels) => onChange({ ...criteria, labels })} />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.folder">Folder</Trans>}
              note={invalidNamespace && <InvalidTokenNote />}
            >
              <FolderMultiFilter
                values={criteria.namespaces}
                invalid={invalidNamespace}
                onChange={(namespaces) => onChange({ ...criteria, namespaces })}
              />
            </SidebarField>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.datasource">Query data source</Trans>}
              note={invalidDataSource && <InvalidTokenNote />}
            >
              <DataSourceMultiFilter
                values={criteria.dataSourceUids}
                invalid={invalidDataSource}
                onChange={(dataSourceUids) => onChange({ ...criteria, dataSourceUids })}
              />
            </SidebarField>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.plugins">Plugin rules</Trans>}>
              <SwitchField
                label={t('alerting.gma-rule-list.search.property.hide-plugin-rules', 'Hide plugin rules')}
                value={criteria.hidePluginRules}
                onChange={(hidePluginRules) => onChange({ ...criteria, hidePluginRules })}
              />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.metric">Recorded metric</Trans>}
            >
              <Input
                placeholder={t('alerting.gma-rule-list.search.metric-placeholder', 'Metric name (exact match)')}
                value={criteria.metric ?? ''}
                onChange={(e) => onChange({ ...criteria, metric: e.currentTarget.value || undefined })}
              />
            </SidebarField>
            <SidebarField
              label={
                <Trans i18nKey="alerting.gma-rule-list.search.property.target-datasource">Target data source</Trans>
              }
            >
              <DataSourcePicker
                current={criteria.targetDataSourceUid}
                noDefault
                onClear={() => onChange({ ...criteria, targetDataSourceUid: undefined })}
                onChange={(ds: DataSourceInstanceSettings) => onChange({ ...criteria, targetDataSourceUid: ds.uid })}
              />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <HealthField value={criteria.health} onChange={(health) => onChange({ ...criteria, health })} />
          </SidebarSection>
        </Stack>
      </Stack>
    </FilterSidebarContainer>
  );
}
