import { NavModel, NavModelItem, PageLayoutType, arrayUtils } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { DashboardLinkForm } from '../settings/links/DashboardLinkForm';
import { DashboardLinkList } from '../settings/links/DashboardLinkList';
import { NEW_LINK } from '../settings/links/utils';
import { getDashboardSceneFor } from '../utils/utils';

import { EditListViewSceneUrlSync } from './EditListViewSceneUrlSync';
import { DashboardEditView, DashboardEditListViewState, useDashboardEditPageNav } from './utils';

export interface DashboardLinksEditViewState extends DashboardEditListViewState {}

export class DashboardLinksEditView extends SceneObjectBase<DashboardLinksEditViewState> implements DashboardEditView {
  static Component = DashboardLinksEditViewRenderer;

  protected _urlSync = new EditListViewSceneUrlSync(this);

  public getUrlKey(): string {
    return 'links';
  }

  private get dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  private get links(): DashboardLink[] {
    return this.dashboard.state.links;
  }

  private set links(links: DashboardLink[]) {
    this.dashboard.setState({ links });
  }

  public onNewLink = () => {
    this.links = [...this.links, NEW_LINK];
    this.setState({ editIndex: this.links.length - 1 });
  };

  public onDelete = (idx: number) => {
    this.links = [...this.links.slice(0, idx), ...this.links.slice(idx + 1)];

    this.setState({ editIndex: undefined });
  };

  public onDuplicate = (link: DashboardLink) => {
    this.links = [...this.links, { ...link }];
  };

  public onOrderChange = (idx: number, direction: number) => {
    this.links = arrayUtils.moveItemImmutably(this.links, idx, idx + direction);
  };

  public onEdit = (editIndex: number) => {
    this.setState({ editIndex });
  };

  public onUpdateLink = (link: DashboardLink) => {
    const idx = this.state.editIndex;

    if (idx === undefined) {
      return;
    }

    this.links = [...this.links.slice(0, idx), link, ...this.links.slice(idx + 1)];
  };

  public onGoBack = () => {
    this.setState({ editIndex: undefined });
  };
}

function DashboardLinksEditViewRenderer({ model }: SceneComponentProps<DashboardLinksEditView>) {
  const { editIndex } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const { links } = dashboard.useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const linkToEdit = editIndex !== undefined ? links[editIndex] : undefined;

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
        links={links}
        onNew={model.onNewLink}
        onEdit={model.onEdit}
        onDelete={model.onDelete}
        onDuplicate={model.onDuplicate}
        onOrderChange={model.onOrderChange}
      />
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
