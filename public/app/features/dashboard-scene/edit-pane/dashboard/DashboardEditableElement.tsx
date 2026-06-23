import { type ReactNode, useId, useMemo } from 'react';

import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneObject, SceneVariableSet, sceneUtils } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { type DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { type DashboardScene } from '../../scene/DashboardScene';
import { useLayoutCategory } from '../../scene/layouts-shared/DashboardLayoutSelector';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';
import { DashboardLinksSet } from '../../settings/links/DashboardLinksSet';
import { DashboardFiltersSet } from '../../settings/variables/DashboardFiltersSet';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';

import { AddAnnotationButton, DashboardAnnotationsList } from './DashboardAnnotationsList';
import { DashboardDescriptionInput, DashboardTitleInput } from './DashboardBasicOptions';
import { AddFilterIconButton, DashboardFiltersList } from './DashboardFiltersList';
import { AddLinkButton, DashboardLinksList } from './DashboardLinksList';
import { AddVariableButton, DashboardVariablesList } from './DashboardVariablesList';

function useEditPaneOptions(
  this: DashboardEditableElement,
  dashboard: DashboardScene
): OptionsPaneCategoryDescriptor[] {
  const { body } = dashboard.useState();
  const dashboardTitleInputId = useId();
  const dashboardDescriptionInputId = useId();

  const dashboardOptions = useMemo(() => {
    const editPaneHeaderOptions = new OptionsPaneCategoryDescriptor({ title: '', id: 'dashboard-options' })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.options.title-option', 'Title'),
          id: dashboardTitleInputId,
          render: () => <DashboardTitleInput id={dashboardTitleInputId} dashboard={dashboard} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.options.description', 'Description'),
          id: dashboardDescriptionInputId,
          render: () => <DashboardDescriptionInput id={dashboardDescriptionInputId} dashboard={dashboard} />,
        })
      );

    return editPaneHeaderOptions;
  }, [dashboard, dashboardDescriptionInputId, dashboardTitleInputId]);

  const layoutCategory = useLayoutCategory(body);
  const filtersCategory = useFiltersCategory(dashboard);
  const variablesCategory = useVariablesCategory(dashboard);
  const annotationsCategory = useAnnotationsCategory(dashboardSceneGraph.getDataLayers(dashboard));
  const linksCategory = useLinksCategory(dashboard);

  return [
    dashboardOptions,
    ...layoutCategory,
    ...filtersCategory,
    ...variablesCategory,
    ...annotationsCategory,
    ...linksCategory,
  ];
}

export class DashboardEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  private _linksSet?: DashboardLinksSet;
  private _filtersSet?: DashboardFiltersSet;

  public constructor(private dashboard: DashboardScene) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.dashboard', 'Dashboard'),
      icon: 'apps',
      instanceName: t('dashboard.edit-pane.elements.dashboard', 'Dashboard'),
    };
  }

  private getLinksSet(): DashboardLinksSet {
    if (!this._linksSet) {
      this._linksSet = new DashboardLinksSet({ dashboardRef: this.dashboard.getRef() });
    }
    return this._linksSet;
  }

  private getFiltersSet(): DashboardFiltersSet {
    if (!this._filtersSet) {
      this._filtersSet = new DashboardFiltersSet({ dashboardRef: this.dashboard.getRef() });
    }
    return this._filtersSet;
  }

  public getOutlineChildren(isEditing: boolean): SceneObject[] {
    const { $variables, body } = this.dashboard.state;
    if (!isEditing || !$variables) {
      return body.getOutlineChildren();
    }
    return [
      ...(config.featureToggles.dashboardUnifiedDrilldownControls ? [this.getFiltersSet()] : []),
      $variables,
      dashboardSceneGraph.getDataLayers(this.dashboard),
      this.getLinksSet(),
      ...body.getOutlineChildren(),
    ];
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.dashboard);

  public renderTopButton(): ReactNode {
    return (
      <Button
        variant="secondary"
        onClick={() => this.dashboard.onOpenSettings()}
        tooltip={t('dashboard.toolbar.dashboard-settings.tooltip', 'Dashboard settings')}
        icon="sliders-v-alt"
        fullWidth
      >
        <Trans i18nKey="dashboard.actions.open-settings">View all settings</Trans>
      </Button>
    );
  }
}

function useFiltersCategory(dashboard: DashboardScene): OptionsPaneCategoryDescriptor[] {
  const { $variables } = dashboard.useState();
  const filterListId = useId();

  return useMemo(() => {
    if (!config.featureToggles.dashboardUnifiedDrilldownControls) {
      return [];
    }

    const filterCount =
      $variables instanceof SceneVariableSet ? $variables.state.variables.filter(sceneUtils.isAdHocVariable).length : 0;

    const title = t('dashboard-scene.use-filters-category.category.title.filters', 'Filters');
    const category = new OptionsPaneCategoryDescriptor({
      title,
      id: 'dashboard-filters',
      headerActions: <AddFilterIconButton dashboard={dashboard} />,
      itemsCount: filterCount,
      renderTitle: () => title,
    });

    if ($variables instanceof SceneVariableSet && filterCount > 0) {
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: filterListId,
          skipField: true,
          render: () => <DashboardFiltersList variableSet={$variables} />,
        })
      );
    }

    return [category];
  }, [$variables, filterListId, dashboard]);
}

function useVariablesCategory(dashboard: DashboardScene): OptionsPaneCategoryDescriptor[] {
  const { $variables } = dashboard.useState();
  const variableListId = useId();

  return useMemo(() => {
    const variableCount =
      $variables instanceof SceneVariableSet
        ? config.featureToggles.dashboardUnifiedDrilldownControls
          ? $variables.state.variables.filter((v) => !sceneUtils.isAdHocVariable(v)).length
          : $variables.state.variables.length
        : 0;

    const title = t('dashboard-scene.use-variables-category.category.title.variables', 'Variables');
    const category = new OptionsPaneCategoryDescriptor({
      title,
      id: 'dashboard-variables',
      headerActions: <AddVariableButton dashboard={dashboard} />,
      itemsCount: variableCount,
      renderTitle: () => title,
    });

    if ($variables instanceof SceneVariableSet && variableCount > 0) {
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: variableListId,
          skipField: true,
          render: () => <DashboardVariablesList sourceVariableSet={$variables} />,
        })
      );
    }

    return [category];
  }, [$variables, variableListId, dashboard]);
}

function useAnnotationsCategory(dataLayerSet: DashboardDataLayerSet): OptionsPaneCategoryDescriptor[] {
  const annotationsListId = useId();
  const { annotationLayers } = dataLayerSet.useState();

  return useMemo(() => {
    const annotationCount = annotationLayers.filter((a) => a instanceof DashboardAnnotationsDataLayer).length;

    const title = t('dashboard-scene.use-annotations-category.category.title.annotations', 'Annotations');
    const category = new OptionsPaneCategoryDescriptor({
      title,
      id: 'dashboard-annotations',
      headerActions: <AddAnnotationButton dataLayerSet={dataLayerSet} />,
      itemsCount: annotationCount,
      renderTitle: () => title,
    });

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: annotationsListId,
        skipField: true,
        render: () => <DashboardAnnotationsList dataLayerSet={dataLayerSet} />,
      })
    );

    return [category];
  }, [dataLayerSet, annotationLayers, annotationsListId]);
}

function useLinksCategory(dashboard: DashboardScene): OptionsPaneCategoryDescriptor[] {
  const { links } = dashboard.useState();
  const linksListId = useId();

  return useMemo(() => {
    const title = t('dashboard-scene.use-links-category.category.title.links', 'Links');
    const category = new OptionsPaneCategoryDescriptor({
      title,
      id: 'dashboard-links',
      headerActions: <AddLinkButton dashboard={dashboard} />,
      itemsCount: links.length,
      renderTitle: () => title,
    });

    if (links.length) {
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: linksListId,
          skipField: true,
          render: () => <DashboardLinksList dashboard={dashboard} />,
        })
      );
    }

    return [category];
  }, [dashboard, links.length, linksListId]);
}
