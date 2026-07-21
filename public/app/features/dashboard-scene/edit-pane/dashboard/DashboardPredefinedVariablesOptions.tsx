import { useMemo } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Field, RadioButtonGroup } from '@grafana/ui';
import {
  AnnoKeyIgnorePredefinedVariables,
  DENY_ALL_FOLDER_PREDEFINED,
  DENY_ALL_GLOBAL_PREDEFINED,
  DENY_ALL_PREDEFINED,
  type ObjectMeta,
} from 'app/features/apiserver/types';

import { type DashboardSceneLike } from '../../scene/types/dashboard';
import {
  parseIgnorePredefinedVariables,
  serializeIgnorePredefinedVariables,
} from '../../utils/predefinedVariableDenyList';

type PredefinedVariablesMode = 'none' | 'all' | 'global' | 'folder';

/** Narrow host surface so this pane does not import DashboardScene (circular dep). */
export type PredefinedVariablesDashboard = DashboardSceneLike & {
  serializer: {
    getK8SMetadata: () => { annotations?: Record<string, string | undefined> } | undefined;
    setK8SAnnotations: (annotations: Record<string, string>) => void;
  };
  refreshPredefinedVariables: () => Promise<void>;
  managedResourceCannotBeEdited: () => boolean;
};

function modeFromDenyList(denyList: string[] | undefined): PredefinedVariablesMode | undefined {
  // Missing / empty deny list → All (inject everything).
  if (denyList === undefined || denyList.length === 0) {
    return 'all';
  }
  if (denyList.includes(DENY_ALL_PREDEFINED)) {
    return 'none';
  }
  if (denyList.length === 1 && denyList[0] === DENY_ALL_FOLDER_PREDEFINED) {
    return 'global';
  }
  if (denyList.length === 1 && denyList[0] === DENY_ALL_GLOBAL_PREDEFINED) {
    return 'folder';
  }
  // Mixed / custom name lists: no radio selected until the user picks a coarse mode.
  return undefined;
}

function denyListFromMode(mode: PredefinedVariablesMode): string[] | undefined {
  switch (mode) {
    case 'all':
      return undefined;
    case 'none':
      return [DENY_ALL_PREDEFINED];
    case 'global':
      return [DENY_ALL_FOLDER_PREDEFINED];
    case 'folder':
      return [DENY_ALL_GLOBAL_PREDEFINED];
  }
}

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

function updateDashboardDenyList(dashboard: PredefinedVariablesDashboard, mode: PredefinedVariablesMode) {
  const nextDenyList = denyListFromMode(mode);
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

  const annotationValue = meta.k8s?.annotations?.[AnnoKeyIgnorePredefinedVariables];
  const mode = useMemo(() => {
    return modeFromDenyList(
      parseIgnorePredefinedVariables(
        annotationValue !== undefined
          ? { [AnnoKeyIgnorePredefinedVariables]: annotationValue }
          : readAnnotationMap(dashboard)
      )
    );
  }, [annotationValue, dashboard]);

  if (!config.featureToggles.globalDashboardVariables) {
    return null;
  }

  const options: Array<SelectableValue<PredefinedVariablesMode>> = [
    {
      label: t('dashboard-scene.predefined-variables-options.none', 'None'),
      value: 'none',
    },
    {
      label: t('dashboard-scene.predefined-variables-options.all', 'All'),
      value: 'all',
    },
    {
      label: t('dashboard-scene.predefined-variables-options.global', 'Global'),
      value: 'global',
    },
    {
      label: t('dashboard-scene.predefined-variables-options.folder', 'Folder'),
      value: 'folder',
    },
  ];

  return (
    <Field
      label={t('dashboard-scene.predefined-variables-options.label', 'Predefined variables')}
      description={t(
        'dashboard-scene.predefined-variables-options.description',
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
