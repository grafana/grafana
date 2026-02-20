import { NavModel, NavModelItem, PageLayoutType, arrayUtils } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { DashboardLinkForm } from '../settings/links/DashboardLinkForm';
import { DashboardLinkList } from '../settings/links/DashboardLinkList';
import { SystemLinksSection } from '../settings/links/SystemLinksSection';
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
    const editableLinks = this.links.filter((l) => l.source === undefined);
    this.links = [...this.links, NEW_LINK];
    this.setState({ editIndex: editableLinks.length });
  };

  /** Index is into the editable links list (excludes default links with source). */
  public onDelete = (editableIndex: number) => {
    const links = this.links;
    const defaultLinks = links.filter((l) => l.source != null);
    const editableLinks = links.filter((l) => l.source === undefined);
    const newEditable = editableLinks.filter((_, i) => i !== editableIndex);
    this.links = [...defaultLinks, ...newEditable];
    this.setState({ editIndex: undefined });
  };

  public onDuplicate = (link: DashboardLink) => {
    this.links = [...this.links, { ...link, source: undefined }];
  };

  /** Indices are into the editable links list. */
  public onOrderChange = (editableIndex: number, direction: number) => {
    const links = this.links;
    const defaultLinks = links.filter((l) => l.source != null);
    const editableLinks = links.filter((l) => l.source === undefined);
    const newEditable = arrayUtils.moveItemImmutably(editableLinks, editableIndex, editableIndex + direction);
    this.links = [...defaultLinks, ...newEditable];
  };

  /** Index is into the editable links list. */
  public onEdit = (editableIndex: number) => {
    this.setState({ editIndex: editableIndex });
  };

  public onUpdateLink = (link: DashboardLink) => {
    const editableIndex = this.state.editIndex;
    if (editableIndex === undefined) {
      return;
    }
    const links = this.links;
    const defaultLinks = links.filter((l) => l.source != null);
    const editableLinks = links.filter((l) => l.source === undefined);
    const newEditable = [...editableLinks];
    newEditable[editableIndex] = link;
    this.links = [...defaultLinks, ...newEditable];
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

  const defaultLinks = links.filter((l) => l.source != null);
  const editableLinks = links.filter((l) => l.source === undefined);
  const linkToEdit = editIndex !== undefined ? editableLinks[editIndex] : undefined;

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
      {defaultLinks.length > 0 && <SystemLinksSection links={defaultLinks} />}
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
