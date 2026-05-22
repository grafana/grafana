import { type EventProperty } from '@grafana/runtime/unstable';

import type { EventLocation } from '../../dashboard/dashgrid/DashboardLibrary/constants';

export interface SaveAsOpenedProperties extends EventProperty {
  /** UID of the source dashboard the user is saving as a template. Empty for new dashboards. */
  dashboardUid: string;
}

export interface SaveAsCompletedProperties extends EventProperty {
  /** UID of the source dashboard the template was created from. */
  dashboardUid: string;
  /** UID of the newly created template resource. */
  templateUid: string;
  /** Whether the user attached at least one tag to the template. */
  hasTags: boolean;
  /** Number of tags attached to the template. */
  tagCount: number;
  /** Whether the user filled in a description for the template. */
  hasDescription: boolean;
}

export interface SaveAsFailedProperties extends EventProperty {
  /** UID of the source dashboard the user attempted to save as a template. */
  dashboardUid: string;
  /** HTTP status returned by the failing request, when available. */
  errorStatus?: number;
}

export interface SaveCompletedProperties extends EventProperty {
  /** UID of the template resource that was saved. */
  templateUid: string;
  /** Whether the user attached a save message describing the change. */
  withMessage: boolean;
  /** Whether the save used the "overwrite" path after a version conflict. */
  overwriteUsed: boolean;
}

export interface SaveFailedProperties extends EventProperty {
  /** UID of the template resource that failed to save. */
  templateUid: string;
  /** HTTP status returned by the failing request, when available. */
  errorStatus?: number;
}

export interface SaveConflictShownProperties extends EventProperty {
  /** UID of the template resource where the conflict was detected. */
  templateUid: string;
}

export interface UsedProperties extends EventProperty {
  /** UID of the template the user is starting from. */
  templateUid: string;
}

export interface EditOpenedProperties extends EventProperty {
  /** UID of the template the user is editing. */
  templateUid: string;
}

export interface DashboardSavedFromTemplateProperties extends EventProperty {
  /** UID of the newly created dashboard. */
  dashboardUid: string;
  /** UID of the source template the dashboard was created from. */
  templateUid: string;
}

export interface VersionRestoredProperties extends EventProperty {
  /** UID of the template resource whose version was restored. */
  templateUid: string;
  /** Version identifier that was restored. */
  version: number;
  /** The specific UI location within the product where the restore was triggered. */
  eventLocation: EventLocation;
}

export interface BannerDismissedProperties extends EventProperty {
  /** UID of the template referenced by the banner. May be empty if the banner rendered before the UID resolved. */
  templateUid: string;
}

export interface SavedBannerGalleryClickedProperties extends EventProperty {
  /** UID of the template referenced by the saved banner. */
  templateUid: string;
}
