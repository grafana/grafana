import { useMemo } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardGlobalVariables } from '@grafana/runtime/internal';
import { Field, RadioButtonGroup } from '@grafana/ui';
import { AnnoKeyIgnorePredefinedVariables, type ObjectMeta } from 'app/features/apiserver/types';

import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { DashboardInteractions } from '../../utils/interactions';
import {
  denyListFromGlobalVariablesMode,
  getGlobalVariablesMode,
  parseIgnorePredefinedVariables,
  serializeIgnorePredefinedVariables,
  type GlobalVariablesMode,
} from '../../utils/predefinedVariableDenyList';

/** Narrow host surface so this pane does not import DashboardScene (circular dep). */
export type PredefinedVariablesDashboard = DashboardSceneLike & {
  serializer: {
    getK8SMetadata: () => { annotations?: Record<string, string | undefined> } | undefined;
    setK8SAnnotations: (annotations: Record<string, string>) => void;
  };
  refreshPredefinedVariables: () => Promise<void>;
  managedResourceCannotBeEdited: () => boolean;
};

function readAnnotationMap(dashboard: PredefinedVariablesDashboard): Record<string, string> {
  const fromMeta = dashboard.state.meta.k8s?.annotations ?? {};
  const fromSerializer = dashboard.serializer.getK8SMetadata()?.annotations ?? {};
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...fromSerializer, ...fromMeta })) {
    if (typeof value === 'string') {
      merged[key] = value;
    }
  }
  return merged;
}

export function updateDashboardDenyList(dashboard: PredefinedVariablesDashboard, mode: GlobalVariablesMode) {
  const fromMode = getGlobalVariablesMode(parseIgnorePredefinedVariables(readAnnotationMap(dashboard)));
  const nextDenyList = denyListFromGlobalVariablesMode(mode);
  const meta = dashboard.state.meta;
  const annotations = readAnnotationMap(dashboard);

  if (nextDenyList === undefined) {
    delete annotations[AnnoKeyIgnorePredefinedVariables];
  } else {
    annotations[AnnoKeyIgnorePredefinedVariables] = serializeIgnorePredefinedVariables(nextDenyList);
  }

  const nextMetaK8s: Partial<ObjectMeta> = {
    ...(meta.k8s ?? {}),
    annotations,
  };

  // Keep serializer metadata in sync so getK8SMetadata() save paths also pick this up.
  dashboard.serializer.setK8SAnnotations(annotations);

  // Changing meta triggers the change tracker; hasMetadataChanges includes this annotation
  // so Save stays enabled until the dashboard is saved (or discarded).
  dashboard.setState({
    meta: {
      ...meta,
      k8s: nextMetaK8s,
    },
  });

  DashboardInteractions.globalVariablesModeChanged({
    from_mode: fromMode,
    to_mode: mode,
  });

  // Update the live variable set immediately so controls match the denylist without a reload.
  // Discard restores the edit-session baseline (including prior predefined variables).
  void dashboard.refreshPredefinedVariables();
}

interface Props {
  dashboard: PredefinedVariablesDashboard;
}

export function DashboardPredefinedVariablesOptions({ dashboard }: Props) {
  const { meta } = dashboard.useState();
  const canEditDenyList = Boolean(meta.canSave) && !dashboard.managedResourceCannotBeEdited();
  const globalDashboardVariablesEnabled = useFlagGrafanaDashboardGlobalVariables();

  const annotationValue = meta.k8s?.annotations?.[AnnoKeyIgnorePredefinedVariables];
  const mode = useMemo(() => {
    return getGlobalVariablesMode(
      parseIgnorePredefinedVariables(
        annotationValue !== undefined
          ? { [AnnoKeyIgnorePredefinedVariables]: annotationValue }
          : readAnnotationMap(dashboard)
      )
    );
  }, [annotationValue, dashboard]);

  if (!globalDashboardVariablesEnabled) {
    return null;
  }

  const options: Array<SelectableValue<GlobalVariablesMode>> = [
    {
      label: t('dashboard.sidebar.predefined-variables.none', 'None'),
      value: 'none',
    },
    {
      label: t('dashboard.sidebar.predefined-variables.all', 'All'),
      value: 'all',
    },
    {
      label: t('dashboard.sidebar.predefined-variables.global', 'Global'),
      value: 'global',
    },
    {
      label: t('dashboard.sidebar.predefined-variables.folder', 'Folder'),
      value: 'folder',
    },
  ];

  return (
    <Field
      label={t('dashboard.sidebar.predefined-variables.label', 'Predefined variables')}
      description={t(
        'dashboard.sidebar.predefined-variables.description',
        'This dashboard receives global and folder-scoped variables by default. Choose which ones to keep.'
      )}
      noMargin
      disabled={!canEditDenyList}
    >
      <RadioButtonGroup
        options={options}
        value={mode}
        onChange={(value) => updateDashboardDenyList(dashboard, value)}
        size="sm"
        fullWidth
        disabled={!canEditDenyList}
      />
    </Field>
  );
}
