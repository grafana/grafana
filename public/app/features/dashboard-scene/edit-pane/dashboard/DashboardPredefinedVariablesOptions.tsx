import { useMemo } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Field, RadioButtonGroup } from '@grafana/ui';
import {
  ALLOW_ALL_FOLDER_PREDEFINED,
  ALLOW_ALL_GLOBAL_PREDEFINED,
  ALLOW_ALL_PREDEFINED,
  AnnoKeyUsePredefinedVariables,
  type ObjectMeta,
} from 'app/features/apiserver/types';

import { type DashboardScene } from '../../scene/DashboardScene';
import {
  parseUsePredefinedVariables,
  serializeUsePredefinedVariables,
  type UsePredefinedVariablesConfig,
} from '../../utils/predefinedVariableAllowList';

type PredefinedVariablesMode = 'none' | 'all' | 'global' | 'folder';

function modeFromConfig(allowlist: UsePredefinedVariablesConfig | undefined): PredefinedVariablesMode | undefined {
  // Missing annotation → None is the default UI selection (no injection).
  if (allowlist === undefined) {
    return 'none';
  }
  const list = allowlist.predefinedVariablesAllowList;
  if (list === ALLOW_ALL_PREDEFINED || (Array.isArray(list) && list.includes(ALLOW_ALL_PREDEFINED))) {
    return 'all';
  }
  if (Array.isArray(list) && list.length === 1 && list[0] === ALLOW_ALL_GLOBAL_PREDEFINED) {
    return 'global';
  }
  if (Array.isArray(list) && list.length === 1 && list[0] === ALLOW_ALL_FOLDER_PREDEFINED) {
    return 'folder';
  }
  if (Array.isArray(list) && list.length === 0) {
    return 'none';
  }
  // Mixed / custom name lists: no radio selected until the user picks a coarse mode.
  return undefined;
}

function configFromMode(mode: PredefinedVariablesMode): UsePredefinedVariablesConfig {
  switch (mode) {
    case 'none':
      return { predefinedVariablesAllowList: [] };
    case 'all':
      return { predefinedVariablesAllowList: ALLOW_ALL_PREDEFINED };
    case 'global':
      return { predefinedVariablesAllowList: [ALLOW_ALL_GLOBAL_PREDEFINED] };
    case 'folder':
      return { predefinedVariablesAllowList: [ALLOW_ALL_FOLDER_PREDEFINED] };
  }
}

function readAnnotationMap(dashboard: DashboardScene): Record<string, string> {
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

function updateDashboardAllowlist(dashboard: DashboardScene, mode: PredefinedVariablesMode) {
  const nextConfig = configFromMode(mode);
  const meta = dashboard.state.meta;
  const annotations = readAnnotationMap(dashboard);
  annotations[AnnoKeyUsePredefinedVariables] = serializeUsePredefinedVariables(nextConfig);

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

  // Update the live variable set immediately so controls match the allowlist without a reload.
  // Discard restores the edit-session baseline (including prior predefined variables).
  void dashboard.refreshPredefinedVariables();
}

interface Props {
  dashboard: DashboardScene;
}

export function DashboardPredefinedVariablesOptions({ dashboard }: Props) {
  const { meta } = dashboard.useState();
  const canEditAllowlist = Boolean(meta.canSave) && !dashboard.managedResourceCannotBeEdited();

  const annotationValue = meta.k8s?.annotations?.[AnnoKeyUsePredefinedVariables];
  const mode = useMemo(() => {
    return modeFromConfig(
      parseUsePredefinedVariables(
        annotationValue !== undefined
          ? { [AnnoKeyUsePredefinedVariables]: annotationValue }
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
        'Choose which global and folder-scoped variables this dashboard receives.'
      )}
      noMargin
      disabled={!canEditAllowlist}
    >
      <RadioButtonGroup
        options={options}
        value={mode}
        onChange={(value) => updateDashboardAllowlist(dashboard, value)}
        size="sm"
        fullWidth
        disabled={!canEditAllowlist}
      />
    </Field>
  );
}
