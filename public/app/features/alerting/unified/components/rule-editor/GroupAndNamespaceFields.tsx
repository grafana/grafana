import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Field, useStyles2, VirtualizedSelect } from '@grafana/ui';
import { RuleNamespace } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { RuleFormValues } from '../../types/rule-form';

interface Props {
  rulesSourceName: string;
}

export const GroupAndNamespaceFields = ({ rulesSourceName }: Props) => {
  const {
    control,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();

  const style = useStyles2(getStyle);
  const { namespaceGroups, isLoading } = useNamespaceGroupOptions(rulesSourceName);

  const namespace = watch('namespace');

  const namespaceOptions: Array<SelectableValue<string>> = useMemo(
    () =>
      Array.from(namespaceGroups.keys()).map((namespace) => ({
        label: namespace,
        value: namespace,
      })),
    [namespaceGroups]
  );

  const groupOptions: Array<SelectableValue<string>> = useMemo(
    () => (namespace && namespaceGroups.get(namespace)?.map((group) => ({ label: group, value: group }))) || [],
    [namespace, namespaceGroups]
  );

  return (
    <div className={style.flexRow}>
      <Field
        data-testid="namespace-picker"
        label="Namespace"
        error={errors.namespace?.message}
        invalid={!!errors.namespace?.message}
      >
        <Controller
          render={({ field: { onChange, ref, ...field } }) => (
            <VirtualizedSelect
              {...field}
              allowCustomValue
              className={style.input}
              onChange={(value) => {
                setValue('group', ''); //reset if namespace changes
                onChange(value.value);
              }}
              options={namespaceOptions}
              width={42}
              isLoading={isLoading}
              disabled={isLoading}
            />
          )}
          name="namespace"
          control={control}
          rules={{
            required: { value: true, message: 'Required.' },
          }}
        />
      </Field>
      <Field data-testid="group-picker" label="Group" error={errors.group?.message} invalid={!!errors.group?.message}>
        <Controller
          render={({ field: { ref, ...field } }) => (
            <VirtualizedSelect
              {...field}
              allowCustomValue
              options={groupOptions}
              width={42}
              onChange={(value) => {
                setValue('group', value.value ?? '');
              }}
              className={style.input}
              isLoading={isLoading}
              disabled={isLoading}
            />
          )}
          name="group"
          control={control}
          rules={{
            required: { value: true, message: 'Required.' },
          }}
        />
      </Field>
    </div>
  );
};

const getStyle = (theme: GrafanaTheme2) => ({
  flexRow: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',

    '& > * + *': {
      marginLeft: theme.spacing(3),
    },
  }),
  input: css({
    width: '330px !important',
  }),
});

const { usePrometheusRuleNamespacesQuery, useLazyRulerRulesQuery } = alertRuleApi;
const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const prometheusRulesPrimary = config.featureToggles.alertingPrometheusRulesPrimary ?? false;

// TODO Depending on the Ruler API preference, we should use the Ruler API if feasible
function useNamespaceGroupOptions(rulesSourceName: string) {
  const { data: features, isLoading: isFeaturesLoading } = useDiscoverDsFeaturesQuery({ rulesSourceName });

  const [fetchRulerRules, { data: rulerRules = {}, isLoading: isRulerRulesLoading }] = useLazyRulerRulesQuery();
  const { data: promNamespaces = [], isLoading: isPrometheusRulesLoading } = usePrometheusRuleNamespacesQuery(
    { ruleSourceName: rulesSourceName },
    { skip: prometheusRulesPrimary }
  );

  useEffect(() => {
    if (features?.rulerConfig && !prometheusRulesPrimary) {
      fetchRulerRules({ rulerConfig: features.rulerConfig });
    }
  }, [features?.rulerConfig, fetchRulerRules]);

  const namespaceGroups = useMemo(() => {
    if (isPrometheusRulesLoading || isRulerRulesLoading) {
      return new Map<string, string[]>();
    }

    if (prometheusRulesPrimary) {
      return promNamespacesToNamespaceGroups(promNamespaces);
    }

    return rulerRulesToNamespaceGroups(rulerRules);
  }, [promNamespaces, rulerRules, isPrometheusRulesLoading, isRulerRulesLoading]);

  return { namespaceGroups, isLoading: isPrometheusRulesLoading || isRulerRulesLoading || isFeaturesLoading };
}

function promNamespacesToNamespaceGroups(promNamespaces: RuleNamespace[]) {
  const groups = new Map<string, string[]>();
  promNamespaces.forEach((namespace) => {
    groups.set(
      namespace.name,
      namespace.groups.map((group) => group.name)
    );
  });
  return groups;
}

function rulerRulesToNamespaceGroups(rulerConfig: RulerRulesConfigDTO) {
  const result = new Map<string, string[]>();
  Object.entries(rulerConfig).forEach(([namespace, groups]) => {
    result.set(
      namespace,
      groups.map((group) => group.name)
    );
  });
  return result;
}
