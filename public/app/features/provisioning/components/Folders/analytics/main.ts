import { defineFeatureEvents } from '@grafana/runtime/unstable';

import {
  type ReadmeCreateClickedProperties,
  type ReadmeEditClickedProperties,
  type ReadmeLinkClickedProperties,
  type ReadmePanelViewedProperties,
  type ReadmeRetryClickedProperties,
} from './types';

const createProvisioningEvent = defineFeatureEvents('grafana', 'provisioning');

/**
 * Analytics events for the provisioned folder README experiment (`provisioning.readmes` toggle).
 */
export const FolderReadmeEvents = {
  /** Fired once per status when the README panel scrolls at least 50 % into view. Provides the denominator for engagement and the status distribution for feature health. */
  panelViewed: createProvisioningEvent<ReadmePanelViewedProperties>('readme_panel_viewed'),
  /** Fired when the user clicks the edit pencil in the panel header to open the host editor. */
  editClicked: createProvisioningEvent<ReadmeEditClickedProperties>('readme_edit_clicked'),
  /** Fired when the user clicks the "Add README" CTA in the empty state to create a README in the host. */
  createClicked: createProvisioningEvent<ReadmeCreateClickedProperties>('readme_create_clicked'),
  /** Fired when the user clicks any anchor inside the rendered README markdown. */
  linkClicked: createProvisioningEvent<ReadmeLinkClickedProperties>('readme_link_clicked'),
  /** Fired when the user clicks "Try again" after a README load failure. */
  retryClicked: createProvisioningEvent<ReadmeRetryClickedProperties>('readme_retry_clicked'),
};
