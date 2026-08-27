import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardGlobalVariables } from '@grafana/runtime/internal';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Checkbox, Counter, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { AnnoKeyUseCrossDashboardVariables, type ObjectMeta } from 'app/features/apiserver/types';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { type DashboardSceneLike } from '../../scene/types/dashboard';
import {
  isScopeNameSelected,
  parseUseCrossDashboardVariables,
  toggleScopeName,
  writeUseCrossDashboardVariables,
  type PredefinedVariableScope,
  type UseCrossDashboardVariables,
} from '../../utils/crossDashboardVariablesSelection';
import { DashboardInteractions } from '../../utils/interactions';
import { fetchPredefinedVariables, getPredefinedOrigin } from '../../utils/predefinedVariables';

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

function persistSelection(dashboard: PredefinedVariablesDashboard, selection: UseCrossDashboardVariables) {
  const meta = dashboard.state.meta;
  const annotations = readAnnotationMap(dashboard);
  writeUseCrossDashboardVariables(annotations, selection);

  const nextMetaK8s: Partial<ObjectMeta> = {
    ...(meta.k8s ?? {}),
    annotations,
  };

  dashboard.serializer.setK8SAnnotations(annotations);

  // Changing meta triggers the change tracker; hasMetadataChanges includes this annotation
  // so Save stays enabled until the dashboard is saved (or discarded).
  dashboard.setState({
    meta: {
      ...meta,
      k8s: nextMetaK8s,
    },
  });

  void dashboard.refreshPredefinedVariables();
}

export function updateDashboardScopeVariable(
  dashboard: PredefinedVariablesDashboard,
  scope: PredefinedVariableScope,
  name: string,
  checked: boolean,
  allNamesInScope: string[]
) {
  const current = parseUseCrossDashboardVariables(readAnnotationMap(dashboard)) ?? {
    global: 'none' as const,
    folder: 'none' as const,
  };
  persistSelection(dashboard, {
    ...current,
    [scope]: toggleScopeName(current[scope], name, checked, allNamesInScope),
  });
  DashboardInteractions.predefinedVariableToggled({ scope, name, checked });
}

interface Props {
  dashboard: PredefinedVariablesDashboard;
}

type CandidatesLoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; variables: VariableKind[] };

export function DashboardPredefinedVariablesOptions({ dashboard }: Props) {
  const { meta } = dashboard.useState();
  const canEditSelection = Boolean(meta.canSave) && !dashboard.managedResourceCannotBeEdited();
  const globalDashboardVariablesEnabled = useFlagGrafanaDashboardGlobalVariables();
  const [loadState, setLoadState] = useState<CandidatesLoadState>({ status: 'loading' });

  const annotationValue = meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables];
  const selection = useMemo(() => {
    return parseUseCrossDashboardVariables(
      annotationValue !== undefined
        ? { [AnnoKeyUseCrossDashboardVariables]: annotationValue }
        : readAnnotationMap(dashboard)
    );
  }, [annotationValue, dashboard]);

  useEffect(() => {
    if (!globalDashboardVariablesEnabled) {
      return;
    }

    let cancelled = false;
    setLoadState({ status: 'loading' });
    void fetchPredefinedVariables(meta.folderUid).then((vars) => {
      if (cancelled) {
        return;
      }
      // null is fetch failure; [] is a successful empty list. Do not fold failure into empty.
      if (vars === null) {
        setLoadState({ status: 'error' });
        return;
      }
      setLoadState({ status: 'ready', variables: vars });
    });

    return () => {
      cancelled = true;
    };
  }, [globalDashboardVariablesEnabled, meta.folderUid]);

  if (!globalDashboardVariablesEnabled) {
    return null;
  }

  const candidates = loadState.status === 'ready' ? loadState.variables : [];
  const globalVars = candidates.filter((variable) => getPredefinedOrigin(variable.spec.origin)?.type === 'global');
  const folderVars = candidates.filter((variable) => getPredefinedOrigin(variable.spec.origin)?.type === 'folder');

  return (
    <Stack direction="column" gap={2}>
      <Text variant="bodySmall" color="secondary">
        {t(
          'dashboard.sidebar.cross-dashboard-variables.description',
          'Choose which global and folder-scoped variables this dashboard receives.'
        )}
      </Text>
      {loadState.status === 'loading' && <Spinner />}
      {loadState.status === 'error' && (
        <Text variant="bodySmall" color="secondary">
          {t('dashboard.sidebar.cross-dashboard-variables.load-error', 'Could not load global and folder variables.')}
        </Text>
      )}
      {/* Mount after the list is known. itemsCount=0 on first paint makes OptionsPaneCategory
          initialize collapsed and never reopen when the checkboxes arrive. */}
      {loadState.status === 'ready' && (
        <div>
          <ScopeCheckboxSection
            scope="global"
            variables={globalVars}
            selection={selection}
            canEdit={canEditSelection}
            emptyLabel={t(
              'dashboard.sidebar.cross-dashboard-variables.empty-global',
              'No global variables in this organization.'
            )}
            sectionLabel={t('dashboard.sidebar.cross-dashboard-variables.global-section', 'Global')}
            dashboard={dashboard}
          />
          <ScopeCheckboxSection
            scope="folder"
            variables={folderVars}
            selection={selection}
            canEdit={canEditSelection}
            emptyLabel={t(
              'dashboard.sidebar.cross-dashboard-variables.empty-folder',
              'No folder variables in this folder.'
            )}
            sectionLabel={t('dashboard.sidebar.cross-dashboard-variables.folder-section', 'Folder')}
            dashboard={dashboard}
          />
        </div>
      )}
    </Stack>
  );
}

interface ScopeCheckboxSectionProps {
  scope: PredefinedVariableScope;
  variables: VariableKind[];
  selection: UseCrossDashboardVariables | undefined;
  canEdit: boolean;
  emptyLabel: string;
  sectionLabel: string;
  dashboard: PredefinedVariablesDashboard;
}

function ScopeCheckboxSection({
  scope,
  variables,
  selection,
  canEdit,
  emptyLabel,
  sectionLabel,
  dashboard,
}: ScopeCheckboxSectionProps) {
  const styles = useStyles2(getScopeSectionStyles);
  const scopeSelection = selection?.[scope] ?? 'none';
  const allNames = variables.map((variable) => variable.spec.name);
  const categoryId = `cross-dashboard-variables-${scope}`;

  return (
    <div className={styles.container}>
      <OptionsPaneCategory
        id={categoryId}
        title={sectionLabel}
        // itemsCount=0 collapses the category; undefined keeps the empty-state copy visible.
        itemsCount={variables.length || undefined}
        headerActionPlacement="left"
        compactIcons
        isNested
        isDashboardSidebar
        className={styles.category}
        renderTitle={() => (
          <span className={styles.title}>
            {sectionLabel}
            <Counter value={variables.length} />
          </span>
        )}
      >
        {variables.length === 0 ? (
          <Text variant="bodySmall" color="secondary">
            {emptyLabel}
          </Text>
        ) : (
          <ul className={styles.list}>
            {variables.map((variable) => (
              <li key={variable.spec.name} className={styles.listItem}>
                <Checkbox
                  label={variable.spec.name}
                  value={isScopeNameSelected(scopeSelection, variable.spec.name)}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateDashboardScopeVariable(
                      dashboard,
                      scope,
                      variable.spec.name,
                      event.currentTarget.checked,
                      allNames
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </OptionsPaneCategory>
    </div>
  );
}

function getScopeSectionStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      '&:last-child': {
        marginBottom: theme.spacing(1),
      },
    }),
    category: css({
      // OptionsPaneCategory adds spacing(2) when nested+expanded; keep Global/Folder tighter.
      '&&': {
        marginBottom: theme.spacing(0.5),
      },
    }),
    title: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    list: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
    }),
    listItem: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.spacing(4),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      '&:hover, &:focus-within': {
        color: theme.colors.text.maxContrast,
        backgroundColor: theme.colors.action.hover,
        boxShadow: `-${theme.spacing(1)} 0 0 0 ${theme.colors.action.hover}`,
      },
    }),
  };
}
