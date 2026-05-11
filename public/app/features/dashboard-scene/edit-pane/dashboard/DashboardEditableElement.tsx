import { type ReactNode, useId, useMemo } from 'react';

import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneObject, SceneVariableSet, sceneUtils } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

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

import { DashboardAnnotationsList } from './DashboardAnnotationsList';
import { DashboardDescriptionInput, DashboardTitleInput } from './DashboardBasicOptions';
import { AddFilterButton, DashboardFiltersList } from './DashboardFiltersList';
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
  const addFilterButtonId = useId();

  return useMemo(() => {
    if (!config.featureToggles.dashboardUnifiedDrilldownControls) {
      return [];
    }

    const category = new OptionsPaneCategoryDescriptor({
      title: t('dashboard-scene.use-filters-category.category.title.filters', 'Filters'),
      id: 'dashboard-filters',
    });

    const hasFilters =
      $variables instanceof SceneVariableSet && $variables.state.variables.some(sceneUtils.isAdHocVariable);

    if (hasFilters) {
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: filterListId,
          skipField: true,
          render: () => <DashboardFiltersList variableSet={$variables} />,
        })
      );
    }

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: addFilterButtonId,
        skipField: true,
        render: () => <AddFilterButton dashboard={dashboard} />,
      })
    );

    return [category];
  }, [$variables, addFilterButtonId, filterListId, dashboard]);
}

function useVariablesCategory(dashboard: DashboardScene): OptionsPaneCategoryDescriptor[] {
  const { $variables } = dashboard.useState();
  const variableListId = useId();
  const addVariableButtonId = useId();

  return useMemo(() => {
    const category = new OptionsPaneCategoryDescriptor({
      title: t('dashboard-scene.use-variables-category.category.title.variables', 'Variables'),
      id: 'dashboard-variables',
    });

    if ($variables instanceof SceneVariableSet && $variables.state.variables.length) {
      const hasVariables = config.featureToggles.dashboardUnifiedDrilldownControls
        ? $variables.state.variables.some((v) => !sceneUtils.isAdHocVariable(v))
        : true;

      if (hasVariables) {
        category.addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            id: variableListId,
            skipField: true,
            render: () => <DashboardVariablesList variableSet={$variables} />,
          })
        );
      }
    }

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: addVariableButtonId,
        skipField: true,
        render: () => <AddVariableButton dashboard={dashboard} />,
      })
    );

    return [category];
  }, [$variables, addVariableButtonId, variableListId, dashboard]);
}

function useAnnotationsCategory(dataLayerSet: DashboardDataLayerSet): OptionsPaneCategoryDescriptor[] {
  const annotationsListId = useId();

  return useMemo(() => {
    const category = new OptionsPaneCategoryDescriptor({
      title: t('dashboard-scene.use-annotations-category.category.title.annotations', 'Annotations'),
      id: 'dashboard-annotations',
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
  }, [dataLayerSet, annotationsListId]);
}

function useLinksCategory(dashboard: DashboardScene): OptionsPaneCategoryDescriptor[] {
  const { links } = dashboard.useState();
  const linksListId = useId();
  const addLinkButtonId = useId();

  return useMemo(() => {
    const category = new OptionsPaneCategoryDescriptor({
      title: t('dashboard-scene.use-links-category.category.title.links', 'Links'),
      id: 'dashboard-links',
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

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: addLinkButtonId,
        skipField: true,
        render: () => <AddLinkButton dashboard={dashboard} />,
      })
    );

    return [category];
  }, [addLinkButtonId, dashboard, links.length, linksListId]);
}
