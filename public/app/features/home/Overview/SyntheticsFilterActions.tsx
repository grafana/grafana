import { pick } from 'lodash';
import { useMemo } from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useAsync } from 'react-use';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, MultiCombobox } from '@grafana/ui';

import {
  hasIgnores,
  IGNORE_LABELS,
  type IgnoreLabel,
  ignoredLabels,
  type SyntheticsScope,
} from '../solutions/syntheticsData';
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

const NO_IGNORES: SyntheticsScope = { job: [], instance: [], probe: [] };

const spec: SolutionFilterSpec<SyntheticsScope> = {
  solution: 'synthetics',
  parse: parseSyntheticsFilter,
  summarize: summarizeSyntheticsFilter,
  defaultValues: (filter) => (filter ? pick(filter, IGNORE_LABELS) : NO_IGNORES),
  hasSelection: hasIgnores,
  // Label names only, for analytics; the values are customer data and never leave the browser.
  customized: (scope) => ignoredLabels(scope).join(','),
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
            name="job"
            label={t('home.solutions.synthetics.filter.jobs', 'Ignore checks')}
            placeholder={t('home.solutions.synthetics.filter.no-jobs', 'No checks ignored')}
            datasource={datasource}
            control={control}
          />
          <IgnoreField
            name="instance"
            label={t('home.solutions.synthetics.filter.instances', 'Ignore targets')}
            placeholder={t('home.solutions.synthetics.filter.no-instances', 'No targets ignored')}
            datasource={datasource}
            control={control}
          />
          <IgnoreField
            name="probe"
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
  name: IgnoreLabel;
  label: string;
  placeholder: string;
  datasource: DataSourceInstanceListItem;
  control: Control<SyntheticsScope>;
}

// One ignore list: loads its own values (the lists are independent, so an ignored job does not
// narrow the targets offered) and is locked until they arrive. A rejected lookup leaves the value
// undefined: an empty list, with custom entry still allowed.
function IgnoreField({ name, label, placeholder, datasource, control }: IgnoreFieldProps) {
  const values = useAsync(() => fetchSyntheticsLabelValues(datasource.uid, name), [datasource.uid, name]);
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
