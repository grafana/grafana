import { SceneObjectBase, type SceneObjectRef, type SceneObjectState } from '@grafana/scenes';

import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { linkEditActions } from './actions';

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

function createLinkEdit(dashboard: DashboardSceneLike, linkIndex: number): LinkEdit {
  const selectionId = linkSelectionId(linkIndex);
  return new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex, key: selectionId });
}

export function linkSelectionId(linkIndex: number) {
  return `dashboard-link-${linkIndex}`;
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
