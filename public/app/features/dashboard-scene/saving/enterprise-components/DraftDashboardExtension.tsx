import { type ComponentType } from 'react';

import { type DashboardScene } from '../../scene/DashboardScene';

interface DraftDashboardComponentProps {
  dashboard: DashboardScene;
}

interface SaveAndPublishButtonProps {
  disabled: boolean;
  // Saves the dashboard with the publish option, so it is not, or no longer, a draft
  onClick: () => void;
}

export interface DraftDashboardExtension {
  // Whether draft mode is enabled for this stack. Drives OSS UI such as the "Show drafts" search filter.
  isEnabled(): boolean;
  // Labels to add to the metadata of a newly created dashboard
  getCreateLabels(): Promise<Record<string, string>>;
  // Shown for dashboards that are drafts. Holds the Publish action.
  DraftBadge: ComponentType<DraftDashboardComponentProps>;
  // Shown next to Save in the save drawer: for new dashboards in draft mode, and for drafts
  SaveAndPublishButton: ComponentType<SaveAndPublishButtonProps>;
}

let internalDraftDashboardExtension: DraftDashboardExtension | null = null;

export function registerDraftDashboardExtension(extension: DraftDashboardExtension | null) {
  internalDraftDashboardExtension = extension;
}

export function getDraftDashboardExtension(): DraftDashboardExtension | null {
  return internalDraftDashboardExtension;
}
