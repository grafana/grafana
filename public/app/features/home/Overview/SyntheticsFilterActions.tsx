import { useMemo } from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useAsync } from 'react-use';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, MultiCombobox } from '@grafana/ui';

import { hasIgnores, type SyntheticsScope } from '../solutions/syntheticsData';
import {
  fetchSyntheticsLabelValues,
  parseSyntheticsFilter,
  summarizeSyntheticsFilter,
  type SyntheticsIgnoreLabel,
} from '../solutions/syntheticsFilter';

import {
  type CardFilterActionsProps,
  SolutionFilterActions,
  type SolutionFilterSpec,
  toOptions,
} from './SolutionFilterActions';

const NO_IGNORES: SyntheticsScope = { jobs: [], instances: [], probes: [] };

// sm_check_info label whose values each ignore list offers.
const IGNORE_LABEL: Record<keyof SyntheticsScope, SyntheticsIgnoreLabel> = {
  jobs: 'job',
  instances: 'instance',
  probes: 'probe',
};

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
      {({ control }) => (
        <>
          <IgnoreField
            name="jobs"
            label={t('home.solutions.synthetics.filter.jobs', 'Ignore checks')}
            placeholder={t('home.solutions.synthetics.filter.no-jobs', 'No checks ignored')}
            datasource={datasource}
            control={control}
          />
          <IgnoreField
            name="instances"
            label={t('home.solutions.synthetics.filter.instances', 'Ignore targets')}
            placeholder={t('home.solutions.synthetics.filter.no-instances', 'No targets ignored')}
            datasource={datasource}
            control={control}
          />
          <IgnoreField
            name="probes"
            label={t('home.solutions.synthetics.filter.probes', 'Ignore probes')}
            placeholder={t('home.solutions.synthetics.filter.no-probes', 'No probes ignored')}
            datasource={datasource}
            control={control}
          />
        </>
      )}
    </SolutionFilterActions>
  );
}

interface IgnoreFieldProps {
  name: keyof SyntheticsScope;
  label: string;
  placeholder: string;
  datasource: DataSourceInstanceListItem;
  control: Control<SyntheticsScope>;
}

// One ignore list: loads its own values (the lists are independent, so an ignored job does not
// narrow the targets offered) and is locked until they arrive. A rejected lookup leaves the value
// undefined: an empty list, with custom entry still allowed.
function IgnoreField({ name, label, placeholder, datasource, control }: IgnoreFieldProps) {
  const values = useAsync(() => fetchSyntheticsLabelValues(datasource.uid, IGNORE_LABEL[name]), [datasource.uid, name]);
  const options = useMemo(() => toOptions(values.value), [values.value]);
  const id = `synthetics-filter-${name}`;

  return (
    <Field label={label} htmlFor={id} noMargin>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <MultiCombobox<string>
            id={id}
            options={options}
            value={field.value}
            isClearable
            createCustomValue
            loading={values.loading}
            disabled={values.loading}
            placeholder={placeholder}
            onChange={(options) => field.onChange(options.map((o) => o.value))}
          />
        )}
      />
    </Field>
  );
}
