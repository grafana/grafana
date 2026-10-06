import { useMemo } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useAsync } from 'react-use';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, MultiCombobox } from '@grafana/ui';

import { hasIgnores, type SyntheticsScope } from '../solutions/syntheticsData';
import {
  fetchSyntheticsLabelValues,
  parseSyntheticsFilter,
  summarizeSyntheticsFilter,
} from '../solutions/syntheticsFilter';

import {
  type CardFilterActionsProps,
  SolutionFilterActions,
  type SolutionFilterSpec,
  toOptions,
} from './SolutionFilterActions';

const NO_IGNORES: SyntheticsScope = { jobs: [], instances: [], probes: [] };

/** Names of the dimensions a scope sets, for analytics; the values are customer data and never leave the browser. */
function customizedDimensions(scope: SyntheticsScope): string {
  const dimensions: string[] = [];
  if (scope.jobs.length > 0) {
    dimensions.push('jobs');
  }
  if (scope.instances.length > 0) {
    dimensions.push('instances');
  }
  if (scope.probes.length > 0) {
    dimensions.push('probes');
  }
  return dimensions.join(',');
}

const spec: SolutionFilterSpec<SyntheticsScope> = {
  solution: 'synthetics',
  parse: parseSyntheticsFilter,
  summarize: summarizeSyntheticsFilter,
  defaultValues: (filter) =>
    filter ? { jobs: filter.jobs, instances: filter.instances, probes: filter.probes } : NO_IGNORES,
  hasSelection: hasIgnores,
  customized: customizedDimensions,
};

export function SyntheticsFilterActions({ datasource }: CardFilterActionsProps) {
  return (
    <SolutionFilterActions
      spec={spec}
      datasource={datasource}
      openLabel={t('home.solutions.synthetics.filter.open', 'Ignore checks, targets, or probes')}
      title={t('home.solutions.synthetics.filter.title', 'Customize Synthetic Monitoring')}
    >
      {(form) => <SyntheticsFilterFields datasource={datasource} form={form} />}
    </SolutionFilterActions>
  );
}

interface SyntheticsFilterFieldsProps {
  datasource: DataSourceInstanceListItem;
  form: UseFormReturn<SyntheticsScope>;
}

function SyntheticsFilterFields({ datasource, form: { control } }: SyntheticsFilterFieldsProps) {
  // The three lists are independent: an ignored job does not narrow the targets offered.
  const jobs = useAsync(() => fetchSyntheticsLabelValues(datasource.uid, 'job'), [datasource.uid]);
  const instances = useAsync(() => fetchSyntheticsLabelValues(datasource.uid, 'instance'), [datasource.uid]);
  const probes = useAsync(() => fetchSyntheticsLabelValues(datasource.uid, 'probe'), [datasource.uid]);
  // A rejected lookup leaves the value undefined: an empty list, with custom entry still allowed.
  const jobOptions = useMemo(() => toOptions(jobs.value), [jobs.value]);
  const instanceOptions = useMemo(() => toOptions(instances.value), [instances.value]);
  const probeOptions = useMemo(() => toOptions(probes.value), [probes.value]);

  return (
    <>
      {/* Each select is locked until its own values arrive. */}
      <Field
        label={t('home.solutions.synthetics.filter.jobs', 'Ignore checks')}
        htmlFor="synthetics-filter-jobs"
        noMargin
      >
        <Controller
          control={control}
          name="jobs"
          render={({ field }) => (
            <MultiCombobox<string>
              id="synthetics-filter-jobs"
              options={jobOptions}
              value={field.value}
              isClearable
              createCustomValue
              loading={jobs.loading}
              disabled={jobs.loading}
              placeholder={t('home.solutions.synthetics.filter.no-jobs', 'No checks ignored')}
              onChange={(options) => field.onChange(options.map((o) => o.value))}
            />
          )}
        />
      </Field>
      <Field
        label={t('home.solutions.synthetics.filter.instances', 'Ignore targets')}
        htmlFor="synthetics-filter-instances"
        noMargin
      >
        <Controller
          control={control}
          name="instances"
          render={({ field }) => (
            <MultiCombobox<string>
              id="synthetics-filter-instances"
              options={instanceOptions}
              value={field.value}
              isClearable
              createCustomValue
              loading={instances.loading}
              disabled={instances.loading}
              placeholder={t('home.solutions.synthetics.filter.no-instances', 'No targets ignored')}
              onChange={(options) => field.onChange(options.map((o) => o.value))}
            />
          )}
        />
      </Field>
      <Field
        label={t('home.solutions.synthetics.filter.probes', 'Ignore probes')}
        htmlFor="synthetics-filter-probes"
        noMargin
      >
        <Controller
          control={control}
          name="probes"
          render={({ field }) => (
            <MultiCombobox<string>
              id="synthetics-filter-probes"
              options={probeOptions}
              value={field.value}
              isClearable
              createCustomValue
              loading={probes.loading}
              disabled={probes.loading}
              placeholder={t('home.solutions.synthetics.filter.no-probes', 'No probes ignored')}
              onChange={(options) => field.onChange(options.map((o) => o.value))}
            />
          )}
        />
      </Field>
    </>
  );
}
