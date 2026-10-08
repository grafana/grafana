import { css } from '@emotion/css';
import { type ReactNode, useCallback, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardGlobalVariables } from '@grafana/runtime/internal';
import {
  type SceneComponentProps,
  type SceneObject,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type SceneVariable,
  SceneVariableSet,
} from '@grafana/scenes';
import { Box, Card, Sidebar, Stack, useStyles2 } from '@grafana/ui';

import { addVariable } from '../../actions/variable/addVariable';
import { changeVariableType } from '../../actions/variable/changeVariableType';
import { isRowItem, isTabItem } from '../../scene/types/LayoutItemTypeGuards';
import { getDashboardSceneLike, type DashboardSceneLike } from '../../scene/types/dashboard';
import { DashboardCrossDashboardVariablesPane } from '../../sidebar/dashboard/DashboardCrossDashboardVariablesPane';
import { type DashboardSidebarPane } from '../../sidebar/types';
import { DashboardInteractions } from '../../utils/interactions';

import {
  type EditableVariableType,
  getEditableVariableMetadata,
  getNextAvailableId,
  getVariableNamePrefix,
  getVariableScene,
  getVariableTypeSelectOptions,
} from './utils';

export function openAddVariablePane(dashboard: DashboardSceneLike) {
  dashboard.state.sidebar.openPane(new VariableAddPane({ sectionOwner: dashboard.getRef() }));
}

export function openAddSectionVariablePane(dashboard: DashboardSceneLike, sectionOwner: SceneObject) {
  dashboard.state.sidebar.openPane(new VariableAddPane({ sectionOwner: sectionOwner.getRef() }));
}

export interface VariableAddPaneState extends SceneObjectState {
  sectionOwner: SceneObjectRef<SceneObject>;
}

export class VariableAddPane extends SceneObjectBase<VariableAddPaneState> implements DashboardSidebarPane {
  public static Component = VariableAddPaneRenderer;
  public excludeFromHistory = true;

  public getId() {
    return 'variable-type-selection' as const;
  }
}

function VariableAddPaneRenderer({ model }: SceneComponentProps<VariableAddPane>) {
  const globalVariablesEnabled = useFlagGrafanaDashboardGlobalVariables();
  const dashboard = getDashboardSceneLike(model);
  const sectionOwner = model.state.sectionOwner.resolve();
  const showScopedVariableTile = globalVariablesEnabled && sectionOwner === dashboard;

  const onAddScopedVariable = useCallback(() => {
    dashboard.state.sidebar.openPane(new DashboardCrossDashboardVariablesPane({}));
  }, [dashboard]);

  const onAddVariable = useCallback(
    async (type: EditableVariableType) => {
      const existing = sectionOwner.state.$variables;
      const variablesSet = existing instanceof SceneVariableSet ? existing : new SceneVariableSet({ variables: [] });

      if (!existing) {
        sectionOwner.setState({ $variables: variablesSet });
      }

      const sectionVars = variablesSet.state.variables ?? [];
      const newVar = await getVariableScene(type, {
        name: getNextAvailableId(getVariableNamePrefix(type), sectionVars),
      });

      addVariable({ source: variablesSet, addedObject: newVar });

      if (sectionOwner === dashboard) {
        DashboardInteractions.variableTypeSelected({ type });
      } else {
        const sectionOwnerType = isRowItem(sectionOwner) ? 'row' : isTabItem(sectionOwner) ? 'tab' : undefined;
        DashboardInteractions.sectionVariableTypeSelected({ type, sectionOwner: sectionOwnerType });
      }
    },
    [dashboard, sectionOwner]
  );

  return (
    <>
      <Sidebar.PaneHeader title={t('dashboard.sidebar.variables.select-type', 'Choose variable type')} />
      <Box padding={2}>
        <VariableTypeSelectionUI
          onSelectType={onAddVariable}
          leading={showScopedVariableTile ? <ScopedVariableCard onClick={onAddScopedVariable} /> : undefined}
        />
      </Box>
    </>
  );
}

export interface VariableTypeChangePaneState extends SceneObjectState {
  variableRef: SceneObjectRef<SceneVariable>;
}

export class VariableTypeChangePane
  extends SceneObjectBase<VariableTypeChangePaneState>
  implements DashboardSidebarPane
{
  public static Component = VariableTypeChangePaneRenderer;
  public excludeFromHistory = true;

  public getId() {
    return 'variable-type-selection' as const;
  }
}

export function openChangeVariableTypePane(variable: SceneVariable) {
  const dashboard = getDashboardSceneLike(variable);
  dashboard.state.sidebar.openPane(new VariableTypeChangePane({ variableRef: variable.getRef() }));
}

function VariableTypeChangePaneRenderer({ model }: SceneComponentProps<VariableTypeChangePane>) {
  const variable = model.state.variableRef.resolve();

  const onChangeVariableType = useCallback(
    async (type: EditableVariableType) => {
      const variableSet = variable.parent;
      const dashboard = getDashboardSceneLike(variable);

      if (!(variableSet instanceof SceneVariableSet)) {
        return;
      }

      if (type === variable.state.type) {
        dashboard.state.sidebar.goBackToPrevious();
        return;
      }

      const newVariable = await getVariableScene(type, {
        name: variable.state.name,
        label: variable.state.label,
        key: variable.state.key,
      });

      changeVariableType({
        source: variableSet,
        oldVariable: variable,
        newVariable,
      });

      DashboardInteractions.variableTypeChanged({ old: variable.state.type, new: newVariable.state.type });
    },
    [variable]
  );

  return (
    <>
      <Sidebar.PaneHeader title={t('dashboard.sidebar.variables.change-type', 'Change variable type')} />
      <Box padding={2}>
        <VariableTypeSelectionUI onSelectType={onChangeVariableType} />
      </Box>
    </>
  );
}

const FILTER_VARIABLE_TYPES: EditableVariableType[] = ['adhoc'];

export function openAddFilterTypePane(dashboard: DashboardSceneLike) {
  dashboard.state.sidebar.openPane(new FilterTypeAddPane({}));
}

export class FilterTypeAddPane extends SceneObjectBase<SceneObjectState> implements DashboardSidebarPane {
  public static Component = FilterTypeAddPaneRenderer;
  public excludeFromHistory = true;

  public getId() {
    return 'filter-type-selection' as const;
  }
}

function FilterTypeAddPaneRenderer({ model }: SceneComponentProps<FilterTypeAddPane>) {
  const globalVariablesEnabled = useFlagGrafanaDashboardGlobalVariables();
  const dashboard = getDashboardSceneLike(model);

  const onAddScopedVariable = useCallback(() => {
    dashboard.state.sidebar.openPane(new DashboardCrossDashboardVariablesPane({ filtersOnly: true }));
  }, [dashboard]);

  const onAddFilter = useCallback(
    async (type: EditableVariableType) => {
      const existing = dashboard.state.$variables;
      const variablesSet = existing instanceof SceneVariableSet ? existing : new SceneVariableSet({ variables: [] });

      if (!existing) {
        dashboard.setState({ $variables: variablesSet });
      }

      const newVar = await getVariableScene(type, {
        name: getNextAvailableId(getVariableNamePrefix(type), variablesSet.state.variables ?? []),
      });

      addVariable({ source: variablesSet, addedObject: newVar });
      DashboardInteractions.variableTypeSelected({ type });
    },
    [dashboard]
  );

  return (
    <>
      <Sidebar.PaneHeader title={t('dashboard.sidebar.filters.select-type', 'Choose filter type')} />
      <Box padding={2}>
        <VariableTypeSelectionUI
          onSelectType={onAddFilter}
          types={FILTER_VARIABLE_TYPES}
          leading={
            globalVariablesEnabled ? (
              <ScopedVariableCard
                onClick={onAddScopedVariable}
                title={t('dashboard.sidebar.filters.global-or-folder-title', 'Global or folder filter variable')}
              />
            ) : undefined
          }
        />
      </Box>
    </>
  );
}

function VariableTypeSelectionUI({
  onSelectType,
  leading,
  types,
}: {
  onSelectType: (type: EditableVariableType) => void;
  leading?: ReactNode;
  types?: EditableVariableType[];
}) {
  const options = useMemo(
    () =>
      types
        ? types.map((type) => {
            const metadata = getEditableVariableMetadata(type);
            return { label: metadata.name, value: type, description: metadata.description };
          })
        : getVariableTypeSelectOptions(),
    [types]
  );
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={0}>
      <Stack direction="column" gap={1}>
        {leading}
        {options.map((option) => (
          <Card
            noMargin
            className={styles.card}
            isCompact
            onClick={() => onSelectType(option.value!)}
            key={option.value}
            title={t('dashboard.sidebar.variables.select-type-card-tooltip', 'Click to select type')}
            data-testid={selectors.components.PanelEditor.ElementEditPane.variableType(option.value!)}
          >
            <Card.Heading>{option.label}</Card.Heading>
            <Card.Description className={styles.cardDescription}>{option.description}</Card.Description>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function ScopedVariableCard({ onClick, title }: { onClick: () => void; title?: string }) {
  const styles = useStyles2(getStyles);

  return (
    <Card
      noMargin
      className={styles.card}
      isCompact
      onClick={onClick}
      title={t('dashboard.sidebar.variables.select-type-card-tooltip', 'Click to select type')}
      data-testid={selectors.components.PanelEditor.ElementEditPane.variableType('global-or-folder')}
    >
      <Card.Heading>
        {title ?? t('dashboard.sidebar.variables.global-or-folder-title', 'Global or folder variable')}
      </Card.Heading>
      <Card.Description className={styles.cardDescription}>
        {t(
          'dashboard.sidebar.variables.global-or-folder-description',
          'Use a variable defined for the organization or this folder'
        )}
      </Card.Description>
    </Card>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      background: theme.colors.background.secondary,

      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    }),
    cardDescription: css({
      fontSize: theme.typography.bodySmall.fontSize,
      marginTop: theme.spacing(0),
    }),
  };
}
