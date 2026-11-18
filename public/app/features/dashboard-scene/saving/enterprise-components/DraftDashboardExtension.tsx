import { type ComponentType } from 'react';

import { type ComponentSize } from '@grafana/ui';

import { type DashboardScene } from '../../scene/DashboardScene';

interface DraftDashboardComponentProps {
  dashboard: DashboardScene;
  // Set by toolbars whose buttons are not the default size
  size?: ComponentSize;
}

export interface DraftDashboardExtension {
  // Whether draft mode is enabled for this stack. Drives OSS UI such as the "Show drafts" search filter.
  isEnabled(): boolean;
  // Labels to add to the metadata of a newly created dashboard
  getCreateLabels(): Promise<Record<string, string>>;
  DraftBadge: ComponentType<DraftDashboardComponentProps>;
  PublishButton: ComponentType<DraftDashboardComponentProps>;
}

let internalDraftDashboardExtension: DraftDashboardExtension | null = null;

export function registerDraftDashboardExtension(extension: DraftDashboardExtension | null) {
  internalDraftDashboardExtension = extension;
}

export function getDraftDashboardExtension(): DraftDashboardExtension | null {
  return internalDraftDashboardExtension;
}
