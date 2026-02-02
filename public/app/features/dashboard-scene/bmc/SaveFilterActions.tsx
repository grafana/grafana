// BMC file for dashboard personalization - Save filter values
import React, { useState } from 'react';

import { AppEvents } from '@grafana/data';
import { useSceneObjectState } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { ButtonSelect, ToolbarButton } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { getPersonalizationSrv } from 'app/features/dashboard/services/PersonalizationSrv';

import { DashboardScene } from '../scene/DashboardScene';

import {
  TimeAndVariableChangeBehavior,
  TimeAndVariableChangeBehaviorState,
} from './behaviors/TimeAndVariablesChangeBehavior';

interface UsePersonalizationActionsResult {
  isLoading: boolean;
  onSaveFilters: (behavior: TimeAndVariableChangeBehaviorState) => void;
  onResetFilters: () => void;
}

function usePersonalizationActions(dashboard: DashboardScene | null, uid: string): UsePersonalizationActionsResult {
  const [isLoading, setIsLoading] = useState(false);

  const onSaveFilters = React.useCallback(
    (behavior: TimeAndVariableChangeBehaviorState) => {
      if (!dashboard) {
        return;
      }
      setIsLoading(true);
      const changes = dashboard.getDashboardChanges(true, true);
      getPersonalizationSrv()
        .saveFilters({
          uid,
          list: (changes?.changedSaveModel as Dashboard)?.templating?.list ?? [],
          time: (changes?.changedSaveModel as Dashboard)?.time,
          hasTimeRangeChanged: behavior?.hasTimeChanges,
        })
        .then(() => {
          appEvents.publish({
            type: AppEvents.alertSuccess.name,
            payload: [t('bmc.dashboard.toolbar.save-filters-success', 'Saved filter values successfully.')],
          });
        })
        .catch((e) => {
          console.error('Failed to save filter values:', e);
          appEvents.publish({
            type: AppEvents.alertError.name,
            payload: [t('bmc.dashboard.toolbar.save-filters-failure', 'Failed to save filter values.')],
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [dashboard, uid]
  );

  const onResetFilters = React.useCallback(() => {
    setIsLoading(true);
    getPersonalizationSrv()
      .resetFilters(uid)
      .then(() => {
        window.location.href = window.location.href.split('?')[0];
      })
      .catch(() => {
        appEvents.publish({
          type: AppEvents.alertError.name,
          payload: [t('bmc.dashboard.toolbar.reset-filters-failure', 'Failed to reset filter values.')],
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [uid]);

  return { isLoading, onSaveFilters, onResetFilters };
}

export function SaveFiltersButton({ dashboard, uid }: { dashboard: DashboardScene; uid: string }) {
  const { isLoading, onSaveFilters } = usePersonalizationActions(dashboard, uid);

  const behaviors = dashboard.state.$behaviors;
  const savePersonalizedFilter = behaviors?.find((b) => b instanceof TimeAndVariableChangeBehavior);
  const timeAndVariableBehavior = savePersonalizedFilter
    ? (useSceneObjectState(savePersonalizedFilter) as TimeAndVariableChangeBehaviorState)
    : undefined;
  const changes = dashboard?.getDashboardChanges(true, true);

  const disabled =
    !timeAndVariableBehavior?.hasChanges || isLoading || !(changes?.hasVariableValueChanges || changes?.hasTimeChanges);

  return (
    <ToolbarButton
      icon={isLoading ? 'fa fa-spinner' : 'bmc-save-filter'}
      tooltip={t('bmc.dashboard.toolbar.save-filters', 'Save filters')}
      disabled={disabled}
      onClick={() => timeAndVariableBehavior && onSaveFilters(timeAndVariableBehavior)}
      key="save-filters-button"
    />
  );
}

export function ResetFiltersButton({ uid }: { uid: string }) {
  const { onResetFilters } = usePersonalizationActions(null, uid);

  return (
    <ButtonSelect
      value={undefined}
      options={[{ label: t('bmc.dashboard.toolbar.reset-filters', 'Reset filters'), value: 'Reset filters' }]}
      title={t('bmc.dashboard.toolbar.reset-filters', 'Reset filters')}
      onChange={onResetFilters}
      key="reset-filters-button"
    />
  );
}
