import { css, cx } from '@emotion/css';
import { PropsOf } from '@emotion/react';
import { useCallback, useEffect, useRef } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { useToggle } from 'react-use';

import { ContactPointSelector } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Button,
  Combobox,
  Icon,
  Input,
  Label,
  MultiCombobox,
  Stack,
  Text,
  Tooltip,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { trackAlertRuleFilterEvent } from '../../Analytics';
import { Spacer } from '../../components/Spacer';
import {
  useAlertingDataSourceOptions,
  useLabelOptions,
  useNamespaceAndGroupOptions,
} from '../../components/rules/Filter/useRuleFilterAutocomplete';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { RuleHealth, RuleSource } from '../../search/rulesSearchParser';

import { AdvancedFilters } from './types';
import {
  emptyAdvancedFilters,
  formAdvancedFiltersToRuleFilter,
  searchQueryToDefaultValues,
  usePluginsFilterStatus,
  usePortalContainer,
} from './utils';

const SIDEBAR_WIDTH = 250;

const canRenderContactPointSelector = contextSrv.hasPermission(AccessControlAction.AlertingReceiversRead);

/**
 * Persistent collapsible filter sidebar for the alert rule list v2.
 * All filters apply immediately on change.
 */
export function RulesFilterSidebar() {
  const [open, toggleOpen] = useToggle(true);
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.sidebar, !open && styles.sidebarCollapsed)}>
      {open ? (
        <>
          <Stack direction="row" alignItems="center">
            <Button size="sm" variant="primary" fill="text" onClick={() => {}}>
              <Trans i18nKey="alerting.rules-filter-sidebar.clear-filters">Clear filters</Trans>
            </Button>
            <Spacer />
            <Button size="sm" variant="secondary" icon="angle-left" onClick={toggleOpen}>
              <Trans i18nKey="alerting.rules-filter-sidebar.hide-filters">Hide filters</Trans>
            </Button>
          </Stack>
          <FilterSidebarForm />
        </>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          icon="filter"
          onClick={toggleOpen}
          aria-label={t('alerting.rule-list.filter-sidebar.collapse', 'Show filters')}
        />
      )}
    </div>
  );
}

function FilterSidebarForm() {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { filterState, updateFilters } = useRulesFilter();
  const { pluginsFilterEnabled } = usePluginsFilterStatus();
  const isApplyingRef = useRef(false);

  // Create portal container for combobox dropdowns
  const portalContainer = usePortalContainer(theme.zIndex.portal + 100);

  const defaultValues = searchQueryToDefaultValues(filterState);

  const methods = useForm<AdvancedFilters>({ defaultValues });
  const { reset, control, register } = methods;

  // Sync form when filterState changes externally (e.g., search query typed in top bar)
  useEffect(() => {
    if (isApplyingRef.current) {
      return;
    }
    reset(searchQueryToDefaultValues(filterState));
  }, [filterState, reset]);

  // Watch all values and apply immediately on change
  const values = useWatch({ control });

  const applyFilters = useCallback(
    (nextValues: Partial<AdvancedFilters>) => {
      isApplyingRef.current = true;

      const merged: AdvancedFilters = { ...emptyAdvancedFilters, ...nextValues };
      const ruleFilter = formAdvancedFiltersToRuleFilter(merged, filterState.freeFormWords);

      trackAlertRuleFilterEvent({ filterMethod: 'search-input', filter: ruleFilter, filterVariant: 'v2' });
      updateFilters(ruleFilter);

      // Reset the flag after the next render cycle
      setTimeout(() => {
        isApplyingRef.current = false;
      }, 0);
    },
    [filterState.freeFormWords, updateFilters]
  );

  // Apply on every change of any field value
  const prevValuesRef = useRef<Partial<AdvancedFilters>>(defaultValues);
  useEffect(() => {
    // Shallow compare to avoid re-applying on mount
    if (JSON.stringify(values) !== JSON.stringify(prevValuesRef.current)) {
      prevValuesRef.current = values;
      applyFilters(values);
    }
  }, [values, applyFilters]);

  const { namespaceOptions, groupOptions, namespacePlaceholder, groupPlaceholder } = useNamespaceAndGroupOptions();
  const { labelOptions } = useLabelOptions();
  const dataSourceOptions = useAlertingDataSourceOptions();

  return (
    <FormProvider {...methods}>
      <form>
        <Stack direction="column" gap={2}>
          <SidebarSection>
            <SidebarField label={<Trans i18nKey="alerting.search.property.rule-name">Rule name</Trans>}>
              <Input
                {...register('ruleName')}
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
                    onChange={(selections) => field.onChange(selections.map((s) => s.value))}
                    placeholder={t('alerting.rules-filter.placeholder-labels', 'Select labels')}
                    portalContainer={portalContainer}
                  />
                )}
              />
            </SidebarField>
            <SidebarField label={<Trans i18nKey="alerting.search.property.state">State</Trans>}>
              <Controller
                name="ruleState"
                control={control}
                render={({ field }) => (
                  <ToggleButtonGroup<AdvancedFilters['ruleState']>
                    value={field.value}
                    onChange={field.onChange}
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
                        field.onChange(option?.value ?? null);
                      }
                    }}
                    value={field.value}
                    isClearable
                    portalContainer={portalContainer}
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
                        field.onChange(option?.value ?? null);
                      }
                    }}
                    value={field.value}
                    isClearable
                    portalContainer={portalContainer}
                  />
                )}
              />
            </SidebarField>
          </SidebarSection>

          <div className={styles.divider} />

          <SidebarSection>
            <SidebarField label={<Trans i18nKey="alerting.search.property.rule-source">Rule source</Trans>}>
              <Controller
                name="ruleSource"
                control={control}
                render={({ field }) => (
                  <ToggleButtonGroup<AdvancedFilters['ruleSource']>
                    value={field.value}
                    onChange={field.onChange}
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
                            In these data sources, you can select Manage alerts via Alerting UI to be able to manage
                            these alert rules in the Grafana UI as well as in the data source where they were
                            configured.
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
                    onChange={(selections) => field.onChange(selections.map((s) => s.value))}
                    placeholder={t('alerting.rules-filter.placeholder-data-sources', 'Select data sources')}
                    portalContainer={portalContainer}
                  />
                )}
              />
            </SidebarField>
          </SidebarSection>

          <div className={styles.divider} />

          {canRenderContactPointSelector && (
            <>
              <SidebarSection>
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
                    render={({ field }) => (
                      <ContactPointSelector
                        placeholder={t('alerting.rules-filter.placeholder-contact-point', 'Select contact point')}
                        value={field.value}
                        isClearable
                        onChange={(cp) => field.onChange(cp?.spec.title ?? null)}
                        portalContainer={portalContainer}
                      />
                    )}
                  />
                </SidebarField>
              </SidebarSection>
              <div className={styles.divider} />
            </>
          )}

          <SidebarSection>
            <SidebarField label={<Trans i18nKey="alerting.search.property.rule-type">Type</Trans>}>
              <Controller
                name="ruleType"
                control={control}
                render={({ field }) => (
                  <ToggleButtonGroup<AdvancedFilters['ruleType']>
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { label: t('common.all', 'All'), value: '*' },
                      { label: t('alerting.rules.type.alert', 'Alert rule'), value: PromRuleType.Alerting },
                      { label: t('alerting.rules.type.recording', 'Recording rule'), value: PromRuleType.Recording },
                    ]}
                  />
                )}
              />
            </SidebarField>

            <SidebarField label={<Trans i18nKey="alerting.search.property.rule-health">Health</Trans>}>
              <Controller
                name="ruleHealth"
                control={control}
                render={({ field }) => (
                  <ToggleButtonGroup<AdvancedFilters['ruleHealth']>
                    value={field.value}
                    onChange={field.onChange}
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
                <SidebarField label={<Trans i18nKey="alerting.rules-filter.plugin-rules">Plugin rules</Trans>}>
                  <Controller
                    name="plugins"
                    control={control}
                    render={({ field }) => (
                      <ToggleButtonGroup<AdvancedFilters['plugins']>
                        value={field.value}
                        onChange={field.onChange}
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
    </FormProvider>
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
  isActive,
  children,
}: {
  label: React.ReactNode;
  isActive?: boolean;
  children: React.ReactNode;
}) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.field}>
      <Label className={styles.fieldLabel}>{label}</Label>
      <div className={cx(styles.fieldValue, isActive && styles.fieldValueActive)}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToggleButtonGroup — vertical list of toggle buttons (single-select)
// ---------------------------------------------------------------------------

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
}

function ToggleButtonGroup<T>({ options, value, onChange }: ToggleButtonGroupProps<T>) {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="column" gap={0.5}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            className={cx(styles.toggleButton, isActive && styles.toggleButtonActive)}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon && (
              <Text color={opt.color}>
                <Icon name={opt.icon} size="sm" className={styles.toggleButtonIcon} />
              </Text>
            )}
            <span className={styles.toggleButtonLabel}>{opt.label}</span>
          </button>
        );
      })}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
    sidebarCollapsed: css({
      width: 0,
      borderRight: 'none',
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
