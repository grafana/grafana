import { type AnnotationQuery, type NavModel, type NavModelItem, PageLayoutType } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagDashboardNewLayouts, useFlagGrafanaDashboardSettingsRedesign } from '@grafana/runtime/internal';
import { type dataLayers, type SceneComponentProps, type VizPanel } from '@grafana/scenes';
import { Alert, Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import {
  CATEGORY_PARAM_NAME,
  HIGHLIGHT_CATEGORY_PARAM_NAME,
} from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { type DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { dataLayersToAnnotations } from '../serialization/dataLayersToAnnotations';
import { DashboardInteractions } from '../utils/interactions';

import { type AnnotationsEditView } from './AnnotationsEditView';
import { AnnotationSettingsEdit } from './annotations/AnnotationSettingsEdit';
import { AnnotationSettingsList } from './annotations/AnnotationSettingsList';
import { useDashboardEditPageNav } from './utils';

export function AnnotationsEditViewRenderer({ model }: SceneComponentProps<AnnotationsEditView>) {
  const dashboard = model.getDashboard();
  const { annotationLayers } = model.getDataLayers().useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const { editIndex } = model.useState();
  const panels = dashboard.getDashboardPanels();

  const annotations: AnnotationQuery[] = dataLayersToAnnotations(annotationLayers);

  const isDynamicDashboardsEnabled = useFlagDashboardNewLayouts();
  const isSettingsPageRedesignEnabled = useFlagGrafanaDashboardSettingsRedesign();

  const goToSidebar = () => {
    locationService.partial({
      editview: null,
      [HIGHLIGHT_CATEGORY_PARAM_NAME]: 'dashboard-annotations',
      [CATEGORY_PARAM_NAME]: 'dashboard-annotations',
    });
    setTimeout(() => {
      dashboard.state.sidebar.openElementSettings(dashboard);
    }, 0);

    DashboardInteractions.takeMeToSidebarClicked({ item: 'annotations' });
  };
  if (isDynamicDashboardsEnabled && isSettingsPageRedesignEnabled) {
    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <Alert
          severity="info"
          title={t('dashboard-scene.dashboard-settings.annotations.title-moved', 'Looking for annotations?')}
        >
          <Trans i18nKey="dashboard-scene.dashboard-settings.annotations.description-moved">
            Annotation settings have moved to the dashboard&apos;s sidebar.
          </Trans>
          <Button onClick={goToSidebar} fill="text" variant="primary" size="md">
            <Trans i18nKey="dashboard-scene.dashboard-settings.annotations.button-moved">Take me there</Trans>
          </Button>
        </Alert>
      </Page>
    );
  }

  if (editIndex != null && editIndex < annotationLayers.length) {
    return (
      <AnnotationsSettingsEditView
        annotationLayer={model.getDataLayer(editIndex)}
        pageNav={pageNav}
        panels={panels}
        editIndex={editIndex}
        navModel={navModel}
        dashboard={dashboard}
        onUpdate={model.onUpdate}
        onBackToList={model.onBackToList}
        onDelete={model.onDelete}
      />
    );
  }

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <AnnotationSettingsList
        annotations={annotations}
        onNew={model.onNew}
        onEdit={model.onEdit}
        onDelete={model.onDelete}
        onMove={model.onMove}
      />
    </Page>
  );
}

interface AnnotationsSettingsEditViewProps {
  annotationLayer: dataLayers.AnnotationsDataLayer;
  pageNav: NavModelItem;
  panels: VizPanel[];
  editIndex: number;
  navModel: NavModel;
  dashboard: DashboardScene;
  onUpdate: (annotation: AnnotationQuery, editIndex: number) => void;
  onBackToList: () => void;
  onDelete: (idx: number) => void;
}

function AnnotationsSettingsEditView({
  annotationLayer,
  pageNav,
  navModel,
  panels,
  editIndex,
  dashboard,
  onUpdate,
  onBackToList,
  onDelete,
}: AnnotationsSettingsEditViewProps) {
  const { name, query } = annotationLayer.useState();

  const editAnnotationPageNav = {
    text: name,
    parentItem: pageNav,
  };

  return (
    <Page navModel={navModel} pageNav={editAnnotationPageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <AnnotationSettingsEdit
        annotation={query}
        editIndex={editIndex}
        panels={panels}
        onUpdate={onUpdate}
        onBackToList={onBackToList}
        onDelete={onDelete}
      />
    </Page>
  );
}
