import { SceneObjectBase, type SceneObjectRef, type SceneObjectState } from '@grafana/scenes';
import type { DashboardLink } from '@grafana/schema';

import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { linkEditActions } from './actions';
import { NEW_LINK } from './utils';

export interface LinkEditState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardSceneLike>;
  linkIndex: number;
}

/**
 * Lightweight scene object representing a dashboard link being edited.
 * Kept separate from LinkAddEditableElement so view-path code (link renderer,
 * outline, links set) can reference it without pulling in the edit-pane UI.
 */
export class LinkEdit extends SceneObjectBase<LinkEditState> {}

// Default to dropdown for new links because if a dashboard has a lot of links,
// the side pane will be pushed down the page and be unscrollable
export function createDefaultLink(): DashboardLink {
  return { ...NEW_LINK, asDropdown: true };
}

function createLinkEdit(dashboard: DashboardSceneLike, linkIndex: number): LinkEdit {
  const selectionId = linkSelectionId(linkIndex);
  return new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex, key: selectionId });
}

export function linkSelectionId(linkIndex: number) {
  return `dashboard-link-${linkIndex}`;
}

export function openAddLinkPane(dashboard: DashboardSceneLike) {
  const newLink = createDefaultLink();
  const linkIndex = (dashboard.state.links ?? []).length;
  const element = createLinkEdit(dashboard, linkIndex);

  linkEditActions.addLink({ dashboard, link: newLink, addedObject: element });
}

export function openEditLinkPane(dashboard: DashboardSceneLike, linkIndex: number) {
  const element = createLinkEdit(dashboard, linkIndex);
  dashboard.state.sidebar.selectObject(element, { force: true, multi: false });
}

export function duplicateLink(dashboard: DashboardSceneLike, linkIndex: number) {
  const links = dashboard.state.links ?? [];
  const link = { ...links[linkIndex] };
  link.title = `${link.title} - Copy`;

  linkEditActions.addLink({ dashboard, link, addedObject: createLinkEdit(dashboard, linkIndex) });
  openEditLinkPane(dashboard, links.length);
}
