import { type EventProperty } from '@grafana/runtime/unstable';

export interface SaveAsOpenedProperties extends EventProperty {
  /** UID of the source dashboard the user is saving as a template. Empty for new dashboards. */
  dashboardUid: string;
}

export interface CreatedProperties extends EventProperty {
  /** Outcome of the create attempt. */
  status: 'completed' | 'failed';
  /** UID of the source dashboard the template was created from. */
  dashboardUid: string;
  /** UID of the newly created template resource. Present when status is 'completed'. */
  templateUid?: string;
  /** Number of tags attached to the template. Present when status is 'completed'. */
  tagCount?: number;
  /** Whether the user filled in a description for the template. Present when status is 'completed'. */
  hasDescription?: boolean;
  /** HTTP status returned by the failing request, when available. Present when status is 'failed'. */
  errorStatus?: number;
}

export interface UpdatedProperties extends EventProperty {
  /** Outcome of the update attempt. */
  status: 'completed' | 'conflict' | 'failed';
  /** UID of the template resource that was updated. */
  templateUid: string;
  /** Whether the user attached a save message describing the change. Present when status is 'completed'. */
  withMessage?: boolean;
  /** Whether the save used the "overwrite" path after a version conflict. Present when status is 'completed'. */
  overwriteUsed?: boolean;
  /** HTTP status returned by the failing request, when available. Present when status is 'failed'. */
  errorStatus?: number;
}

export interface UpdatedMetadataProperties extends EventProperty {
  /** Outcome of the metadata update attempt. */
  status: 'completed' | 'conflict' | 'failed';
  /** UID of the template resource whose metadata was updated. */
  templateUid: string;
  /** Number of tags attached to the template. Present when status is 'completed'. */
  tagCount?: number;
  /** Whether the user filled in a description for the template. Present when status is 'completed'. */
  hasDescription?: boolean;
  /** HTTP status returned by the failing request, when available. Present when status is 'failed'. */
  errorStatus?: number;
}

export interface DeleteCompletedProperties extends EventProperty {
  /** UID of the template resource that was deleted. */
  templateUid: string;
}

export interface BrowsedProperties extends EventProperty {
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
}

export interface BannerDismissedProperties extends EventProperty {
  /** UID of the template referenced by the banner. May be empty if the banner rendered before the UID resolved. */
  templateUid: string;
}

export interface SavedBannerGalleryClickedProperties extends EventProperty {
  /** UID of the template referenced by the saved banner. */
  templateUid: string;
}
