import { type NavModel, type NavModelItem, PageLayoutType } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagDashboardNewLayouts, useFlagGrafanaDashboardSettingsRedesign } from '@grafana/runtime/internal';
import { type SceneComponentProps } from '@grafana/scenes';
import { type DashboardLink } from '@grafana/schema';
import { Alert, Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import {
  CATEGORY_PARAM_NAME,
  HIGHLIGHT_CATEGORY_PARAM_NAME,
} from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { type DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { DashboardLinkForm } from '../settings/links/DashboardLinkForm';
import { DashboardLinkList } from '../settings/links/DashboardLinkList';
import { ProvisionedLinksSection } from '../settings/links/ProvisionedLinksSection';
import { isLinkEditable } from '../settings/links/utils';
import { SidebarCategoryType } from '../sidebar/types';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { type DashboardLinksEditView } from './DashboardLinksEditView';
import { useDashboardEditPageNav } from './utils';

export function DashboardLinksEditViewRenderer({ model }: SceneComponentProps<DashboardLinksEditView>) {
  const { editIndex } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const { links } = dashboard.useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const defaultLinks = links.filter((link) => !isLinkEditable(link));
  const editableLinks = links.filter(isLinkEditable);
  const linkToEdit = editIndex !== undefined ? editableLinks[editIndex] : undefined;

  const isDynamicDashboardsEnabled = useFlagDashboardNewLayouts();
  const isSettingsPageRedesignEnabled = useFlagGrafanaDashboardSettingsRedesign();

  const goToSidebar = () => {
    locationService.partial({
      editview: null,
      [HIGHLIGHT_CATEGORY_PARAM_NAME]: SidebarCategoryType.DashboardLinks,
      [CATEGORY_PARAM_NAME]: SidebarCategoryType.DashboardLinks,
    });
    setTimeout(() => {
      dashboard.state.sidebar.openElementSettings(dashboard);
    }, 0);

    DashboardInteractions.takeMeToSidebarClicked({ item: 'links' });
  };

  if (isDynamicDashboardsEnabled && isSettingsPageRedesignEnabled) {
    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <Alert
          severity="info"
          title={t('dashboard-scene.dashboard-settings.links.title-moved', 'Looking for link settings?')}
        >
          <Trans i18nKey="dashboard-scene.dashboard-settings.links.description-moved">
            Link settings have moved to the dashboard&apos;s sidebar.
          </Trans>
          <Button onClick={goToSidebar} fill="text" variant="primary" size="md">
            <Trans i18nKey="dashboard-scene.dashboard-settings.links.button-moved">Take me there</Trans>
          </Button>
        </Alert>
      </Page>
    );
  }

  if (linkToEdit) {
    return (
      <EditLinkView
        pageNav={pageNav}
        navModel={navModel}
        link={linkToEdit}
        dashboard={dashboard}
        onChange={model.onUpdateLink}
        onGoBack={model.onGoBack}
      />
    );
  }

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <DashboardLinkList
        links={editableLinks}
        onNew={model.onNewLink}
        onEdit={model.onEdit}
        onDelete={model.onDelete}
        onDuplicate={model.onDuplicate}
        onOrderChange={model.onOrderChange}
      />
      {defaultLinks.length > 0 && <ProvisionedLinksSection links={defaultLinks} />}
    </Page>
  );
}

interface EditLinkViewProps {
  link?: DashboardLink;
  pageNav: NavModelItem;
  navModel: NavModel;
  dashboard: DashboardScene;
  onChange: (link: DashboardLink) => void;
  onGoBack: () => void;
}

function EditLinkView({ pageNav, link, navModel, dashboard, onChange, onGoBack }: EditLinkViewProps) {
  const editLinkPageNav = {
    text: t('dashboard-scene.edit-link-view.edit-link-page-nav.text.edit-link', 'Edit link'),
    parentItem: pageNav,
  };

  return (
    <Page navModel={navModel} pageNav={editLinkPageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <DashboardLinkForm link={link!} onUpdate={onChange} onGoBack={onGoBack} />
    </Page>
  );
}
