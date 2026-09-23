import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardGlobalVariables } from '@grafana/runtime/internal';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Checkbox, Counter, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { type DashboardSceneLike } from '../../scene/types/dashboard';
import {
  isPredefinedNameSelected,
  parseUseCrossDashboardVariables,
  setScopeAll,
  toggleSelectionName,
  type PredefinedVariableScope,
  type UseCrossDashboardVariables,
} from '../../utils/crossDashboardVariablesSelection';
import { DashboardInteractions } from '../../utils/interactions';
import {
  parseUseCrossDashboardVariablesFromHost,
  persistUseCrossDashboardVariables,
  readUseCrossDashboardVariablesAnnotations,
  type CrossDashboardVariablesHost,
} from '../../utils/persistUseCrossDashboardVariables';
import { fetchPredefinedVariables, getPredefinedOrigin } from '../../utils/predefinedVariables';

/** Narrow host surface so this pane does not import DashboardScene (circular dep). */
export type CrossDashboardVariablesDashboard = DashboardSceneLike &
  CrossDashboardVariablesHost & {
    managedResourceCannotBeEdited: () => boolean;
  };

export function updateDashboardScopeVariable(
  dashboard: CrossDashboardVariablesDashboard,
  scope: PredefinedVariableScope,
  name: string,
  checked: boolean,
  allNamesInScope: string[]
) {
  const current = parseUseCrossDashboardVariablesFromHost(dashboard) ?? {
    global: 'none' as const,
    folder: 'none' as const,
  };
  void persistUseCrossDashboardVariables(
    dashboard,
    toggleSelectionName(current, scope, name, checked, allNamesInScope)
  );
  DashboardInteractions.predefinedVariableToggled({ scope, checked });
}

export function updateDashboardScopeAll(
  dashboard: CrossDashboardVariablesDashboard,
  scope: PredefinedVariableScope,
  checked: boolean
) {
  const current = parseUseCrossDashboardVariablesFromHost(dashboard) ?? {
    global: 'none' as const,
    folder: 'none' as const,
  };
  void persistUseCrossDashboardVariables(dashboard, {
    ...current,
    [scope]: setScopeAll(checked),
  });
  DashboardInteractions.predefinedVariableToggled({ scope, checked });
}

/** Opt the shown names in or out without changing the rest of the scope. */
export function setShownScopeNames(
  selection: UseCrossDashboardVariables,
  scope: PredefinedVariableScope,
  shownNames: string[],
  allNamesInScope: string[],
  checked: boolean
): UseCrossDashboardVariables {
  const current = selection[scope];

  if (checked) {
    if (current === 'all') {
      return selection;
    }
    const names = current === 'none' ? [] : [...current];
    for (const name of shownNames) {
      if (!names.includes(name)) {
        names.push(name);
      }
    }
    const coversScope =
      allNamesInScope.length > 0 && allNamesInScope.every((name) => names.includes(name));
    return {
      ...selection,
      [scope]: coversScope ? 'all' : names.length === 0 ? 'none' : names,
    };
  }

  const names = current === 'all' ? allNamesInScope : current === 'none' ? [] : current;
  const remaining = names.filter((name) => !shownNames.includes(name));
  return {
    ...selection,
    [scope]: remaining.length === 0 ? 'none' : remaining,
  };
}

interface Props {
  dashboard: CrossDashboardVariablesDashboard;
  /** When set, only ad hoc and group-by variables are listed. */
  filtersOnly?: boolean;
}

const FILTER_VARIABLE_KINDS = new Set<VariableKind['kind']>(['AdhocVariable', 'GroupByVariable']);

function isFilterVariableKind(variable: VariableKind): boolean {
  return FILTER_VARIABLE_KINDS.has(variable.kind);
}

type CandidatesLoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; variables: VariableKind[] };

export function DashboardCrossDashboardVariablesOptions({ dashboard, filtersOnly = false }: Props) {
  const { meta } = dashboard.useState();
  const canEditSelection = Boolean(meta.canSave) && !dashboard.managedResourceCannotBeEdited();
  const globalDashboardVariablesEnabled = useFlagGrafanaDashboardGlobalVariables();
  const [loadState, setLoadState] = useState<CandidatesLoadState>({ status: 'loading' });

  const annotationValue = meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables];
  const selection = useMemo(() => {
    return parseUseCrossDashboardVariables(
      annotationValue !== undefined
        ? { [AnnoKeyUseCrossDashboardVariables]: annotationValue }
        : readUseCrossDashboardVariablesAnnotations(dashboard)
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
  const visibleGlobalVars = filtersOnly ? globalVars.filter(isFilterVariableKind) : globalVars;
  const visibleFolderVars = filtersOnly ? folderVars.filter(isFilterVariableKind) : folderVars;

  return (
    <Stack direction="column" gap={2}>
      <Text variant="bodySmall" color="secondary">
        {filtersOnly
          ? t(
              'dashboard.sidebar.cross-dashboard-variables.filters-description',
              'Choose which global and folder-scoped filters this dashboard receives.'
            )
          : t(
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
            variables={visibleGlobalVars}
            allNamesInScope={globalVars.map((variable) => variable.spec.name)}
            limitSelectionToShown={filtersOnly}
            selection={selection}
            canEdit={canEditSelection}
            emptyLabel={
              filtersOnly
                ? t(
                    'dashboard.sidebar.cross-dashboard-variables.empty-global-filters',
                    'No global filters in this organization.'
                  )
                : t(
                    'dashboard.sidebar.cross-dashboard-variables.empty-global',
                    'No global variables in this organization.'
                  )
            }
            sectionLabel={t('dashboard.sidebar.cross-dashboard-variables.global-section', 'Global')}
            dashboard={dashboard}
          />
          <ScopeCheckboxSection
            scope="folder"
            variables={visibleFolderVars}
            allNamesInScope={folderVars.map((variable) => variable.spec.name)}
            limitSelectionToShown={filtersOnly}
            selection={selection}
            canEdit={canEditSelection}
            emptyLabel={
              filtersOnly
                ? t(
                    'dashboard.sidebar.cross-dashboard-variables.empty-folder-filters',
                    'No folder filters in this folder.'
                  )
                : t('dashboard.sidebar.cross-dashboard-variables.empty-folder', 'No folder variables in this folder.')
            }
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
  /** Every name in the scope, including ones hidden by filtersOnly. */
  allNamesInScope: string[];
  /** All checkbox opts in only the listed variables, not the whole scope. */
  limitSelectionToShown: boolean;
  selection: UseCrossDashboardVariables | undefined;
  canEdit: boolean;
  emptyLabel: string;
  sectionLabel: string;
  dashboard: CrossDashboardVariablesDashboard;
}

function ScopeCheckboxSection({
  scope,
  variables,
  allNamesInScope,
  limitSelectionToShown,
  selection,
  canEdit,
  emptyLabel,
  sectionLabel,
  dashboard,
}: ScopeCheckboxSectionProps) {
  const styles = useStyles2(getScopeSectionStyles);
  const scopeSelection = selection?.[scope] ?? 'none';
  const shownNames = variables.map((variable) => variable.spec.name);
  const allShownSelected =
    shownNames.length > 0 && shownNames.every((name) => isPredefinedNameSelected(selection, scope, name));
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
            <li className={styles.listItem}>
              <Checkbox
                label={
                  scope === 'global'
                    ? t('dashboard.sidebar.cross-dashboard-variables.select-all-global', 'All global')
                    : t('dashboard.sidebar.cross-dashboard-variables.select-all-folder', 'All folder')
                }
                value={limitSelectionToShown ? allShownSelected : scopeSelection === 'all'}
                disabled={!canEdit}
                onChange={(event) => {
                  if (!limitSelectionToShown) {
                    updateDashboardScopeAll(dashboard, scope, event.currentTarget.checked);
                    return;
                  }
                  const current = parseUseCrossDashboardVariablesFromHost(dashboard) ?? {
                    global: 'none' as const,
                    folder: 'none' as const,
                  };
                  void persistUseCrossDashboardVariables(
                    dashboard,
                    setShownScopeNames(current, scope, shownNames, allNamesInScope, event.currentTarget.checked)
                  );
                  DashboardInteractions.predefinedVariableToggled({ scope, checked: event.currentTarget.checked });
                }}
              />
            </li>
            {variables.map((variable) => (
              <li key={variable.spec.name} className={styles.listItem}>
                <Checkbox
                  label={variable.spec.name}
                  value={isPredefinedNameSelected(selection, scope, variable.spec.name)}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateDashboardScopeVariable(
                      dashboard,
                      scope,
                      variable.spec.name,
                      event.currentTarget.checked,
                      allNamesInScope
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
