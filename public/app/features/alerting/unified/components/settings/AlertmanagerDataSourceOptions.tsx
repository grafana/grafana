import { type ComponentProps, useMemo } from 'react';

import { type DataSourceSettings, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, SelectMenuOptions, Stack } from '@grafana/ui';
import { type AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';

import { getAlertManagerDataSources } from '../../utils/datasource';

interface Options {
  /** Badge the datasources auto-sync can mirror. */
  annotateAutoSync: boolean;
  /** Grey out the datasources auto-sync can't mirror, for pickers that only make sense for auto-sync. */
  disableIneligible?: boolean;
}

/**
 * Every Alertmanager datasource as a picker option, marking the Mimir and Cortex ones auto-sync can mirror.
 * Render them with AlertmanagerDataSourceOption to show the mark as a badge.
 */
export function useAlertmanagerDataSourceOptions(
  autoSyncEligibleAlertmanagers: Array<DataSourceSettings<AlertManagerDataSourceJsonData>>,
  { annotateAutoSync, disableIneligible = false }: Options
): Array<SelectableValue<string>> {
  return useMemo(() => {
    const isEligible = (uid: string) => autoSyncEligibleAlertmanagers.some((ds) => ds.uid === uid);
    const options: Array<SelectableValue<string>> = getAlertManagerDataSources().map((ds) => ({
      label: ds.name,
      value: ds.uid,
      imgUrl: ds.meta.info.logos.small,
      description: ds.url || undefined,
      supportsAutoSync: annotateAutoSync ? isEligible(ds.uid) : undefined,
      isDisabled: disableIneligible ? !isEligible(ds.uid) : undefined,
    }));

    // The datasource list and the eligibility list come from different places; don't drop an eligible
    // datasource only because the other list doesn't have it.
    for (const ds of autoSyncEligibleAlertmanagers) {
      if (!options.some((option) => option.value === ds.uid)) {
        options.push({
          label: ds.name,
          value: ds.uid,
          imgUrl: ds.typeLogoUrl,
          description: ds.url || undefined,
          supportsAutoSync: annotateAutoSync ? true : undefined,
        });
      }
    }
    return options;
  }, [autoSyncEligibleAlertmanagers, annotateAutoSync, disableIneligible]);
}

/** A picker option with an "Auto-sync" badge on the datasources that support it. */
export function AlertmanagerDataSourceOption(props: ComponentProps<typeof SelectMenuOptions>) {
  return (
    <SelectMenuOptions
      {...props}
      renderOptionLabel={({ label, supportsAutoSync }) => (
        <Stack direction="row" alignItems="center" gap={1}>
          <span>{label}</span>
          {supportsAutoSync && (
            <Badge text={t('alerting.import-to-gma.step1.datasource-autosync-badge', 'Auto-sync')} color="green" />
          )}
        </Stack>
      )}
    />
  );
}
