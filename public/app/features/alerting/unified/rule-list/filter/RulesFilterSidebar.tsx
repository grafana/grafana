import { css, cx } from '@emotion/css';
import { type PropsOf } from '@emotion/react';
import { Controller, useForm } from 'react-hook-form';

import { ContactPointSelector, RoutingTreeSelector } from '@grafana/alerting/unstable';
import type { RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import type { GrafanaTheme2 } from '@grafana/data/themes';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Combobox, Input, Label, MultiCombobox, Stack, Text, Tooltip } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { trackAlertRuleFilterEvent } from '../../Analytics';
import {
  useAlertingDataSourceOptions,
  useLabelOptions,
  useNamespaceAndGroupOptions,
} from '../../components/rules/Filter/useRuleFilterAutocomplete';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { RuleHealth, RuleSource, type RulesFilter } from '../../search/rulesSearchParser';

import { type AdvancedFilters } from './types';
import { advancedFiltersToRulesFilter, searchQueryToDefaultValues, usePluginsFilterStatus } from './utils';

const SIDEBAR_WIDTH = 250;

/**
 * Persistent filter sidebar for the alert rule list v2.
 * All filters apply immediately on change; rule name applies on blur or Enter.
 */
export function RulesFilterSidebar() {
  const styles = useStyles2(getStyles);
  const { hasActiveFilters, clearAll, searchQuery, filterState } = useRulesFilter();

  return (
    <div className={styles.sidebar}>
      <Stack direction="column" gap={0}>
        <Stack direction="row" justifyContent="flex-end">
          <Button size="sm" variant="primary" fill="text" onClick={clearAll} disabled={!hasActiveFilters}>
            <Trans i18nKey="alerting.rules-filter-sidebar.clear-filters">Clear filters</Trans>
          </Button>
        </Stack>
        {/* key remounts the form when the URL changes externally (top bar, clearAll, navigation)
            so defaultValues always reflect the current URL state — no sync effects needed */}
        <FilterSidebarForm key={searchQuery} filterState={filterState} />
      </Stack>
    </div>
  );
}

interface FilterSidebarFormProps {
  filterState: RulesFilter;
}

function FilterSidebarForm({ filterState }: FilterSidebarFormProps) {
  const styles = useStyles2(getStyles);

  const { updateFilters } = useRulesFilter();
  const { pluginsFilterEnabled } = usePluginsFilterStatus();
  const canRenderContactPointSelector = contextSrv.hasPermission(AccessControlAction.AlertingReceiversRead);

  const defaults = searchQueryToDefaultValues(filterState);

  const { control, watch, register, setValue } = useForm<AdvancedFilters>({
    defaultValues: defaults,
  });

  const contactPointValue = watch('contactPoint');
  const policyValue = watch('policy');
  const isContactPointDisabled = Boolean(policyValue);
  const isPolicyDisabled = Boolean(contactPointValue);

  function applyFormValues(overrides: Partial<AdvancedFilters> = {}) {
    const formValues = watch();
    const ruleFilter = advancedFiltersToRulesFilter({ ...formValues, ...overrides }, filterState.freeFormWords);
    trackAlertRuleFilterEvent({ filterMethod: 'search-input', filter: ruleFilter, filterVariant: 'v2' });
    updateFilters(ruleFilter);
  }

  function handleContactPointChange(cp: { spec: { title: string } } | null) {
    const contactPoint = cp?.spec.title ?? null;
    setValue('contactPoint', contactPoint);
    if (contactPoint) {
      setValue('policy', null);
      applyFormValues({ contactPoint, policy: null });
    } else {
      applyFormValues({ contactPoint });
    }
  }

  function handlePolicyChange(tree: RoutingTree | null) {
    const policy = tree?.metadata.name ?? null;
    setValue('policy', policy);
    if (policy) {
      setValue('contactPoint', null);
      applyFormValues({ policy, contactPoint: null });
    } else {
      applyFormValues({ policy });
    }
  }

  const { namespaceOptions, groupOptions, namespacePlaceholder, groupPlaceholder } = useNamespaceAndGroupOptions();
  const { labelOptions } = useLabelOptions();
  const dataSourceOptions = useAlertingDataSourceOptions();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        applyFormValues();
      }}
    >
      <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      <Stack direction="column" gap={2}>
        <SidebarSection>
          <SidebarField label={<Trans i18nKey="alerting.search.property.rule-name">Rule name</Trans>}>
            <Input
              {...register('ruleName')}
              onBlur={() => applyFormValues()}
              placeholder={t('alerting.rule-list.filter-sidebar.rule-name-placeholder', 'Filter by name...')}
              data-testid="rule-name-filter-input"
            />
          </SidebarField>
          <SidebarField label={<Trans i18nKey="alerting.search.property.labels">Labels</Trans>}>
            <Controller
              name="labels"
              control={control}
              render={({ field }) => (
                <MultiCombobox
                  options={labelOptions}
                  value={field.value}
                  onChange={(selections) => {
                    const labels = selections.map((s) => s.value);
                    field.onChange(labels);
                    applyFormValues({ labels });
                  }}
                  placeholder={t('alerting.rules-filter.placeholder-labels', 'Select labels')}
                />
              )}
            />
          </SidebarField>
          <SidebarField
            label={<Trans i18nKey="alerting.search.property.state">State</Trans>}
            labelId="filter-label-state"
          >
            <Controller
              name="ruleState"
              control={control}
              render={({ field }) => (
                <ToggleButtonGroup<AdvancedFilters['ruleState']>
                  aria-labelledby="filter-label-state"
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    applyFormValues({ ruleState: value });
                  }}
                  options={[
                    { label: t('common.all', 'All'), value: '*' },
                    {
                      label: t('alerting.rules.state.firing', 'Firing'),
                      value: PromAlertingRuleState.Firing,
                      icon: 'exclamation-circle',
                      color: 'error',
                    },
                    {
                      label: t('alerting.rules.state.normal', 'Normal'),
                      value: PromAlertingRuleState.Inactive,
                      icon: 'check-circle',
                      color: 'success',
                    },
                    {
                      label: t('alerting.rules.state.pending', 'Pending'),
                      value: PromAlertingRuleState.Pending,
                      icon: 'circle',
                      color: 'warning',
                    },
                    {
                      label: t('alerting.rules.state.recovering', 'Recovering'),
                      value: PromAlertingRuleState.Recovering,
                      icon: 'arrow-up',
                      color: 'info',
                    },
                  ]}
                />
              )}
            />
          </SidebarField>
        </SidebarSection>

        <div className={styles.divider} />

        <SidebarSection>
          <SidebarField label={<Trans i18nKey="alerting.search.property.namespace">Folder / Namespace</Trans>}>
            <Controller
              name="namespace"
              control={control}
              render={({ field }) => (
                <Combobox<string>
                  placeholder={namespacePlaceholder}
                  options={namespaceOptions}
                  onChange={(option) => {
                    if (!option?.infoOption) {
                      const namespace = option?.value ?? null;
                      field.onChange(namespace);
                      applyFormValues({ namespace });
                    }
                  }}
                  value={field.value}
                  isClearable
                />
              )}
            />
          </SidebarField>
          <SidebarField label={<Trans i18nKey="alerting.search.property.evaluation-group">Evaluation group</Trans>}>
            <Controller
              name="groupName"
              control={control}
              render={({ field }) => (
                <Combobox<string>
                  placeholder={groupPlaceholder}
                  options={groupOptions}
                  onChange={(option) => {
                    if (!option?.infoOption) {
                      const groupName = option?.value ?? null;
                      field.onChange(groupName);
                      applyFormValues({ groupName });
                    }
                  }}
                  value={field.value}
                  isClearable
                />
              )}
            />
          </SidebarField>
        </SidebarSection>

        <div className={styles.divider} />

        <SidebarSection>
          <SidebarField
            label={<Trans i18nKey="alerting.search.property.rule-source">Rule source</Trans>}
            labelId="filter-label-rule-source"
          >
            <Controller
              name="ruleSource"
              control={control}
              render={({ field }) => (
                <ToggleButtonGroup<AdvancedFilters['ruleSource']>
                  aria-labelledby="filter-label-rule-source"
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    applyFormValues({ ruleSource: value });
                  }}
                  options={[
                    { label: t('common.all', 'All'), value: null },
                    {
                      label: t('alerting.rules-filter.rule-source.grafana', 'Grafana managed'),
                      value: RuleSource.Grafana,
                    },
                    {
                      label: t('alerting.rules-filter.rule-source.datasource', 'Data source managed'),
                      value: RuleSource.DataSource,
                    },
                  ]}
                />
              )}
            />
          </SidebarField>

          <SidebarField
            label={
              <Stack gap={0.5} alignItems="center">
                <span>
                  <Trans i18nKey="alerting.search.property.data-source">Data source</Trans>
                </span>
                <Tooltip
                  content={
                    <div>
                      <p>
                        <Trans i18nKey="alerting.rules-filter.configured-alert-rules">
                          Data sources containing configured alert rules are Mimir or Loki data sources where alert
                          rules are stored and evaluated in the data source itself.
                        </Trans>
                      </p>
                      <p>
                        <Trans i18nKey="alerting.rules-filter.manage-alerts">
                          In these data sources, you can select Manage alerts via Alerting UI to be able to manage these
                          alert rules in the Grafana UI as well as in the data source where they were configured.
                        </Trans>
                      </p>
                    </div>
                  }
                >
                  <Icon
                    name="info-circle"
                    size="sm"
                    title={t(
                      'alerting.rules-filter.data-source-picker-inline-help-title-search-by-data-sources-help',
                      'Search by data sources help'
                    )}
                  />
                </Tooltip>
              </Stack>
            }
          >
            <Controller
              name="dataSourceNames"
              control={control}
              render={({ field }) => (
                <MultiCombobox
                  options={dataSourceOptions}
                  value={field.value}
                  onChange={(selections) => {
                    const dataSourceNames = selections.map((s) => s.value);
                    field.onChange(dataSourceNames);
                    applyFormValues({ dataSourceNames });
                  }}
                  placeholder={t('alerting.rules-filter.placeholder-data-sources', 'Select data sources')}
                />
              )}
            />
          </SidebarField>
        </SidebarSection>

        <div className={styles.divider} />

        {(canRenderContactPointSelector || config.featureToggles.alertingMultiplePolicies) && (
          <>
            <SidebarSection>
              {canRenderContactPointSelector && (
                <SidebarField
                  label={
                    <Stack gap={0.5} alignItems="center">
                      <span>
                        <Trans i18nKey="alerting.contactPointFilter.label">Contact point</Trans>
                      </span>
                      <Tooltip
                        content={
                          <Trans i18nKey="alerting.rules-filter.contact-point-tooltip">
                            Filters alert rules which route directly to the selected contact point. Alert rules routed
                            to notification policies will not be displayed.
                          </Trans>
                        }
                      >
                        <Icon
                          name="info-circle"
                          size="sm"
                          title={t('alerting.rules-filter.contact-point-tooltip-title', 'Contact point filter help')}
                        />
                      </Tooltip>
                    </Stack>
                  }
                >
                  <Controller
                    name="contactPoint"
                    control={control}
                    render={({ field }) => {
                      const selector = (
                        <ContactPointSelector
                          placeholder={t('alerting.rules-filter.placeholder-contact-point', 'Select contact point')}
                          value={field.value}
                          isClearable
                          disabled={isContactPointDisabled}
                          onChange={handleContactPointChange}
                        />
                      );

                      if (isContactPointDisabled) {
                        return (
                          <Tooltip
                            content={t(
                              'alerting.rules-filter.contact-point-disabled-tooltip',
                              'Contact point filtering is not available while a notification policy filter is active.'
                            )}
                            placement="top"
                          >
                            <div>{selector}</div>
                          </Tooltip>
                        );
                      }

                      return selector;
                    }}
                  />
                </SidebarField>
              )}
              {config.featureToggles.alertingMultiplePolicies && (
                <SidebarField
                  label={
                    <Stack gap={0.5} alignItems="center">
                      <span>
                        <Trans i18nKey="alerting.policyFilter.label">Notification policy</Trans>
                      </span>
                      <Tooltip
                        content={
                          <Trans i18nKey="alerting.rules-filter.policy-tooltip">
                            Filters alert rules which route to the selected notification policy tree. Alert rules using
                            direct contact point routing will not be displayed.
                          </Trans>
                        }
                      >
                        <Icon
                          name="info-circle"
                          size="sm"
                          title={t('alerting.rules-filter.policy-tooltip-title', 'Notification policy filter help')}
                        />
                      </Tooltip>
                    </Stack>
                  }
                >
                  <Controller
                    name="policy"
                    control={control}
                    render={({ field }) => {
                      const selector = (
                        <RoutingTreeSelector
                          placeholder={t('alerting.rules-filter.placeholder-policy', 'Select policy')}
                          value={field.value ?? undefined}
                          isClearable
                          disabled={isPolicyDisabled}
                          onChange={handlePolicyChange}
                        />
                      );

                      if (isPolicyDisabled) {
                        return (
                          <Tooltip
                            content={t(
                              'alerting.rules-filter.policy-disabled-tooltip',
                              'Notification policy filtering is not available while a contact point filter is active.'
                            )}
                            placement="top"
                          >
                            <div>{selector}</div>
                          </Tooltip>
                        );
                      }

                      return selector;
                    }}
                  />
                </SidebarField>
              )}
            </SidebarSection>
            <div className={styles.divider} />
          </>
        )}

        <SidebarSection>
          <SidebarField
            label={<Trans i18nKey="alerting.search.property.rule-type">Type</Trans>}
            labelId="filter-label-rule-type"
          >
            <Controller
              name="ruleType"
              control={control}
              render={({ field }) => (
                <ToggleButtonGroup<AdvancedFilters['ruleType']>
                  aria-labelledby="filter-label-rule-type"
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    applyFormValues();
                  }}
                  options={[
                    { label: t('common.all', 'All'), value: '*' },
                    { label: t('alerting.rules.type.alert', 'Alert rule'), value: PromRuleType.Alerting },
                    { label: t('alerting.rules.type.recording', 'Recording rule'), value: PromRuleType.Recording },
                  ]}
                />
              )}
            />
          </SidebarField>

          <SidebarField
            label={<Trans i18nKey="alerting.search.property.rule-health">Health</Trans>}
            labelId="filter-label-rule-health"
          >
            <Controller
              name="ruleHealth"
              control={control}
              render={({ field }) => (
                <ToggleButtonGroup<AdvancedFilters['ruleHealth']>
                  aria-labelledby="filter-label-rule-health"
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    applyFormValues();
                  }}
                  options={[
                    { label: t('common.all', 'All'), value: '*' },
                    { label: t('alerting.rules.health.ok', 'OK'), value: RuleHealth.Ok },
                    { label: t('alerting.rules.health.no-data', 'No data'), value: RuleHealth.NoData },
                    { label: t('alerting.rules.health.error', 'Error'), value: RuleHealth.Error },
                  ]}
                />
              )}
            />
          </SidebarField>
        </SidebarSection>

        {pluginsFilterEnabled && (
          <>
            <div className={styles.divider} />
            <SidebarSection>
              <SidebarField
                label={<Trans i18nKey="alerting.rules-filter.plugin-rules">Plugin rules</Trans>}
                labelId="filter-label-plugins"
              >
                <Controller
                  name="plugins"
                  control={control}
                  render={({ field }) => (
                    <ToggleButtonGroup<AdvancedFilters['plugins']>
                      aria-labelledby="filter-label-plugins"
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        applyFormValues();
                      }}
                      options={[
                        { label: t('alerting.rules-filter.label.show', 'Show'), value: 'show' },
                        { label: t('alerting.rules-filter.label.hide', 'Hide'), value: 'hide' },
                      ]}
                    />
                  )}
                />
              </SidebarField>
            </SidebarSection>
          </>
        )}
      </Stack>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Section & field layout helpers
// ---------------------------------------------------------------------------

function SidebarSection({ children }: { children: React.ReactNode }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.section}>
      <Stack direction="column" gap={1.5}>
        {children}
      </Stack>
    </div>
  );
}

function SidebarField({
  label,
  children,
  labelId,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  labelId?: string;
}) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.field}>
      <Label id={labelId} className={styles.fieldLabel}>
        {label}
      </Label>
      <div className={styles.fieldValue}>{children}</div>
    </div>
  );
}

interface ToggleOption<T> {
  label: string;
  value: T;
  icon?: PropsOf<typeof Icon>['name'];
  color?: PropsOf<typeof Text>['color'];
}

interface ToggleButtonGroupProps<T> {
  options: Array<ToggleOption<T>>;
  value: T;
  onChange: (value: T) => void;
  'aria-labelledby': string;
}

function ToggleButtonGroup<T>({ options, value, onChange, 'aria-labelledby': labelledBy }: ToggleButtonGroupProps<T>) {
  const styles = useStyles2(getStyles);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy}>
      <Stack direction="column" gap={0.5}>
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={cx(styles.toggleButton, isActive && styles.toggleButtonActive)}
              onClick={() => onChange(opt.value)}
            >
              {opt.icon && (
                <Text color={opt.color}>
                  <Icon name={opt.icon} size="sm" className={styles.toggleButtonIcon} aria-hidden="true" />
                </Text>
              )}
              <span className={styles.toggleButtonLabel}>{opt.label}</span>
            </button>
          );
        })}
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    sidebar: css({
      width: SIDEBAR_WIDTH,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      paddingRight: theme.spacing(2),
      paddingBottom: theme.spacing(2),
    }),
    section: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    divider: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      flexShrink: 0,
    }),
    field: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    fieldLabel: css({
      marginBottom: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    fieldValue: css({
      position: 'relative',
    }),
    fieldValueActive: css({
      paddingLeft: theme.spacing(1),
      '&::before': {
        content: '""',
        display: 'block',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: theme.spacing(0.25),
        backgroundImage: theme.colors.gradients.brandVertical,
        borderRadius: theme.shape.radius.default,
      },
    }),
    toggleButton: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      width: '100%',
      padding: `${theme.spacing(0.5)} ${theme.spacing(0.75)}`,
      background: 'none',
      border: `1px solid transparent`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      textAlign: 'left',
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
    }),
    toggleButtonActive: css({
      background: theme.colors.action.selected,
      color: theme.colors.text.primary,
    }),
    toggleButtonIcon: css({
      flexShrink: 0,
    }),
    toggleButtonLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
