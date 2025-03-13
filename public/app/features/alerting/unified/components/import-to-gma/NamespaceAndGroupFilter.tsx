import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, VirtualizedSelect, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import { promNamespacesToNamespaceGroups, rulerRulesToNamespaceGroups } from '../rule-editor/useAlertRuleSuggestions';

import { ImportFormValues } from './ImportFromDSRules';

interface Props {
  rulesSourceName: string;
}

export const NamespaceAndGroupFilter = ({ rulesSourceName }: Props) => {
  const {
    control,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<ImportFormValues>();

  const style = useStyles2(getStyle);
  const namespace = watch('namespace');
  const { namespaceGroups, isLoading } = useGetNameSpacesByDatasourceName(rulesSourceName);

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
    <div className={style.filterBox}>
      <Field
        data-testid="namespace-picker"
        label={t('alerting.import-to-gma.namespace.label', 'Namespace')}
        // Disable translations as we don't intend to use this dropdown longterm,
        // so avoiding us adding translations for the sake of it
        // eslint-disable-next-line @grafana/no-untranslated-strings
        description={t('alerting.import-to-gma.namespace.description', 'Type to search for an existing namespace')}
        error={errors.namespace?.message}
        invalid={!!errors.namespace?.message}
      >
        <Controller
          render={({ field: { onChange, ref, ...field } }) => (
            <VirtualizedSelect
              {...field}
              className={style.input}
              onChange={(value) => {
                setValue('ruleGroup', ''); //reset if namespace changes
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
        />
      </Field>
      <Field
        data-testid="group-picker"
        label={t('alerting.import-to-gma.group.label', 'Group')}
        // Disable translations as we don't intend to use this dropdown longterm,
        // so avoiding us adding translations for the sake of it
        // eslint-disable-next-line @grafana/no-untranslated-strings
        description={t(
          'alerting.import-to-gma.group.description',
          'Type to search for an existing group or create a new one'
        )}
        error={errors.ruleGroup?.message}
        invalid={!!errors.ruleGroup?.message}
      >
        <Controller
          render={({ field: { ref, ...field } }) => (
            <VirtualizedSelect
              {...field}
              allowCustomValue
              options={groupOptions}
              width={42}
              onChange={(value) => {
                setValue('ruleGroup', value.value ?? '');
              }}
              className={style.input}
              isLoading={isLoading}
              disabled={isLoading}
            />
          )}
          name="ruleGroup"
          control={control}
        />
      </Field>
    </div>
  );
};

const getStyle = (theme: GrafanaTheme2) => ({
  input: css({
    width: '330px !important',
  }),
  filterBox: css({
    display: 'flex',
    flexDirection: 'row',
    paddingLeft: theme.spacing(1),
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
});

function useGetNameSpacesByDatasourceName(rulesSourceName: string) {
  const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
  const { usePrometheusRuleNamespacesQuery, useLazyRulerRulesQuery } = alertRuleApi;
  const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();
  const emptyRulerConfig: RulerRulesConfigDTO = {};
  const { data: features, isLoading: isFeaturesLoading } = useDiscoverDsFeaturesQuery({ rulesSourceName });

  // emptyRulerConfig is used to prevent from triggering  labels' useMemo all the time
  // rulerRules = {} creates a new object and triggers useMemo to recalculate labels
  const [fetchRulerRules, { data: rulerRules = emptyRulerConfig, isLoading: isRulerRulesLoading }] =
    useLazyRulerRulesQuery();

  const { data: promNamespaces = [], isLoading: isPrometheusRulesLoading } = usePrometheusRuleNamespacesQuery(
    { ruleSourceName: rulesSourceName },
    { skip: !prometheusRulesPrimary }
  );

  useEffect(() => {
    if (features?.rulerConfig && !prometheusRulesPrimary) {
      fetchRulerRules({ rulerConfig: features.rulerConfig });
    }
  }, [features?.rulerConfig, fetchRulerRules, prometheusRulesPrimary]);

  const namespaceGroups = useMemo(() => {
    if (isPrometheusRulesLoading || isRulerRulesLoading) {
      return new Map<string, string[]>();
    }

    if (prometheusRulesPrimary) {
      return promNamespacesToNamespaceGroups(promNamespaces);
    }

    return rulerRulesToNamespaceGroups(rulerRules);
  }, [promNamespaces, rulerRules, isPrometheusRulesLoading, isRulerRulesLoading, prometheusRulesPrimary]);

  return { namespaceGroups, isLoading: isPrometheusRulesLoading || isRulerRulesLoading || isFeaturesLoading };
}
