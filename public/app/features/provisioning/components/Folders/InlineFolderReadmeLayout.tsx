import { type ReactNode } from 'react';

import { config } from '@grafana/runtime';

import { FolderReadmePanel } from './FolderReadmePanel';

interface Props {
  folderUID: string | undefined;
  isProvisionedFolder: boolean;
  className: string;
  children: ReactNode;
}

/**
 * Wraps the dashboards sub-view and, when the feature is active, appends a
 * README panel as a sibling below it.
 */
export function InlineFolderReadmeLayout({ folderUID, isProvisionedFolder, className, children }: Props) {
  const enabled = !!config.featureToggles.provisioningReadmes && isProvisionedFolder && !!folderUID;

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <>
      <div className={className}>{children}</div>
      <FolderReadmePanel folderUID={folderUID} />
    </>
  );
}
