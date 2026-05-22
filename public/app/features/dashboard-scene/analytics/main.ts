import { defineFeatureEvents } from '@grafana/runtime/unstable';

import {
  type BannerDismissedProperties,
  type DashboardSavedFromTemplateProperties,
  type EditOpenedProperties,
  type SaveAsCompletedProperties,
  type SaveAsFailedProperties,
  type SaveAsOpenedProperties,
  type SaveCompletedProperties,
  type SaveConflictShownProperties,
  type SaveFailedProperties,
  type SavedBannerGalleryClickedProperties,
  type UsedProperties,
  type VersionRestoredProperties,
} from './types';

const SCHEMA_VERSION = 1;

const createCustomTemplateEvent = defineFeatureEvents('grafana', 'custom_dashboard_template', {
  /** Version of the event schema, used to handle breaking changes in the properties contract. */
  schema_version: SCHEMA_VERSION,
});

/**
 * Analytics events for the Custom (org-defined) Dashboard Templates feature lifecycle:
 * save flows, banners, version history, and page-load lifecycle.
 *
 * Gallery / discovery events live in the `grafana_dashboard_library_*` namespace and
 * are differentiated by `contentKind: 'custom_dashboard_template'`.
 */
export const CustomDashboardTemplateInteractions = {
  /** Fired when the user opens the "Save as template" flow from a dashboard's save menu. */
  saveAsOpened: createCustomTemplateEvent<SaveAsOpenedProperties>('save_as_opened'),
  /** Fired when the user successfully creates a new template from a dashboard. */
  saveAsCompleted: createCustomTemplateEvent<SaveAsCompletedProperties>('save_as_completed'),
  /** Fired when creating a new template fails. */
  saveAsFailed: createCustomTemplateEvent<SaveAsFailedProperties>('save_as_failed'),
  /** Fired when the user successfully saves changes to an existing template. */
  saveCompleted: createCustomTemplateEvent<SaveCompletedProperties>('save_completed'),
  /** Fired when saving changes to an existing template fails. */
  saveFailed: createCustomTemplateEvent<SaveFailedProperties>('save_failed'),
  /** Fired when the template save form surfaces a version conflict (HTTP 409) to the user. */
  saveConflictShown: createCustomTemplateEvent<SaveConflictShownProperties>('save_conflict_shown'),
  /** Fired when a user opens the "use template" flow that hydrates a new (unsaved) dashboard from a template. */
  used: createCustomTemplateEvent<UsedProperties>('used'),
  /** Fired when a user opens an existing template in edit mode. */
  editOpened: createCustomTemplateEvent<EditOpenedProperties>('edit_opened'),
  /** Fired on the first save of a dashboard that was created from a custom template. */
  dashboardSavedFromTemplate: createCustomTemplateEvent<DashboardSavedFromTemplateProperties>(
    'dashboard_saved_from_template'
  ),
  /** Fired when a user successfully restores a prior version of a template from version history. */
  versionRestored: createCustomTemplateEvent<VersionRestoredProperties>('version_restored'),
  /** Fired when the user dismisses the "you are using a template" banner. */
  templateUseBannerDismissed: createCustomTemplateEvent<BannerDismissedProperties>('use_banner_dismissed'),
  /** Fired when the user dismisses the "you are editing a template" banner. */
  templateEditBannerDismissed: createCustomTemplateEvent<BannerDismissedProperties>('edit_banner_dismissed'),
  /** Fired when the user clicks the "template gallery" link inside the "Template created" banner. */
  savedBannerGalleryClicked:
    createCustomTemplateEvent<SavedBannerGalleryClickedProperties>('saved_banner_gallery_clicked'),
};
