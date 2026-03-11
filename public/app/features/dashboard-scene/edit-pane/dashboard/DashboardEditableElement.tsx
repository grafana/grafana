import { ReactNode, useId, useMemo } from 'react';

import { t, Trans } from '@grafana/i18n';
import { SceneObject, SceneVariableSet } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { useLayoutCategory } from '../../scene/layouts-shared/DashboardLayoutSelector';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { DashboardLinksSet } from '../../settings/links/DashboardLinksSet';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';

import { DashboardAnnotationsList } from './DashboardAnnotationsList';
import { DashboardDescriptionInput, DashboardTitleInput } from './DashboardBasicOptions';
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
  const variablesCategory = useVariablesCategory(dashboard);
  const annotationsCategory = useAnnotationsCategory(dashboardSceneGraph.getDataLayers(dashboard));
  const linksCategory = useLinksCategory(dashboard);

  return [dashboardOptions, ...layoutCategory, ...variablesCategory, ...annotationsCategory, ...linksCategory];
}

export class DashboardEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  private _linksSet?: DashboardLinksSet;

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

  public getOutlineChildren(isEditing: boolean): SceneObject[] {
    const { $variables, body } = this.dashboard.state;
    if (!isEditing || !$variables) {
      return body.getOutlineChildren();
    }
    return [
      $variables,
      dashboardSceneGraph.getDataLayers(this.dashboard),
      this.getLinksSet(),
      ...body.getOutlineChildren(),
    ];
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.dashboard);

  public renderActions(): ReactNode {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => this.dashboard.onOpenSettings()}
        tooltip={t('dashboard.toolbar.dashboard-settings.tooltip', 'Dashboard settings')}
        icon="sliders-v-alt"
        iconPlacement="right"
      >
        <Trans i18nKey="dashboard.actions.open-settings">Settings</Trans>
      </Button>
    );
  }
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
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: variableListId,
          skipField: true,
          render: () => <DashboardVariablesList variableSet={$variables} />,
        })
      );
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
