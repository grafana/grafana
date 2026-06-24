import { defineFeatureEvents } from '@grafana/runtime/unstable';

import {
  type BannerDismissedProperties,
  type DashboardSavedFromTemplateProperties,
  type EditOpenedProperties,
  type CreatedProperties,
  type SaveAsOpenedProperties,
  type UpdatedProperties,
  type SavedBannerGalleryClickedProperties,
  type LoadedProperties,
  type VersionRestoredProperties,
  type UpdatedMetadataProperties,
  type DeleteCompletedProperties,
} from './types';

const createCustomTemplateEvent = defineFeatureEvents('grafana', 'custom_dashboard_template');

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
  /** Fired when the user attempts to create a new template from a dashboard. */
  created: createCustomTemplateEvent<CreatedProperties>('created'),
  /** Fired when the user attempts to save changes to an existing template. */
  updated: createCustomTemplateEvent<UpdatedProperties>('updated'),
  /** Fired when the user attempts to save changes to the template metadata. */
  updatedMetadata: createCustomTemplateEvent<UpdatedMetadataProperties>('updated_metadata'),
  /** Fired when the user successfully deletes a template. */
  deleted: createCustomTemplateEvent<DeleteCompletedProperties>('deleted'),
  /** Fired when a user opens the "use template" flow that hydrates a new (unsaved) dashboard from a template. */
  loaded: createCustomTemplateEvent<LoadedProperties>('loaded'),
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
