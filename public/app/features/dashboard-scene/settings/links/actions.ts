import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';
import { type DashboardLink } from '@grafana/schema';

import { dashboardEditActions } from '../../edit-pane/shared';
import { type DashboardScene } from '../../scene/DashboardScene';

export const linkEditActions = {
  addLink({
    dashboard,
    link,
    addedObject,
  }: {
    dashboard: DashboardScene;
    link: DashboardLink;
    addedObject?: SceneObject;
  }) {
    const linksBefore = [...(dashboard.state.links ?? [])];

    dashboardEditActions.edit({
      description: t('dashboard-scene.link-edit-actions.add-link', 'Add link'),
      source: dashboard,
      addedObject,
      perform() {
        dashboard.setState({ links: [...linksBefore, link] });
      },
      undo() {
        dashboard.setState({ links: linksBefore });
      },
    });
  },

  removeLink({ dashboard, linkIndex }: { dashboard: DashboardScene; linkIndex: number }) {
    const linksBefore = [...(dashboard.state.links ?? [])];

    dashboardEditActions.edit({
      description: t('dashboard-scene.link-edit-actions.remove-link', 'Remove link'),
      source: dashboard,
      perform() {
        dashboard.setState({ links: linksBefore.filter((_, i) => i !== linkIndex) });
      },
      undo() {
        dashboard.setState({ links: linksBefore });
      },
    });
  },

  updateLink({
    dashboard,
    linkIndex,
    oldLink,
    newLink,
    description,
  }: {
    dashboard: DashboardScene;
    linkIndex: number;
    oldLink: DashboardLink;
    newLink: DashboardLink;
    description?: string;
  }) {
    dashboardEditActions.edit({
      description: description ?? t('dashboard-scene.link-edit-actions.update-link', 'Update link'),
      source: dashboard,
      perform() {
        const links = [...(dashboard.state.links ?? [])];
        links[linkIndex] = newLink;
        dashboard.setState({ links });
      },
      undo() {
        const links = [...(dashboard.state.links ?? [])];
        links[linkIndex] = oldLink;
        dashboard.setState({ links });
      },
    });
  },
};
