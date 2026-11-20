import { Suspense, lazy } from 'react';

import { PermissionsLoading } from 'app/core/components/AccessControl/PermissionsLoading';

import { type FolderPermissionsExposedComponentProps } from './FolderPermissionsExposedComponent';

// the registry is built during app init, so split the permissions editor out of the entry chunk.
const FolderPermissionsExposedComponent = lazy(() =>
  import(/* webpackChunkName: "FolderPermissionsExposedComponent" */ './FolderPermissionsExposedComponent').then(
    (module) => ({ default: module.FolderPermissionsExposedComponent })
  )
);

/**
 * exposed component (stable): grafana/folder-permissions/v1
 *
 * treat its props and user-visible behavior as a stable contract. breaking changes go in a new
 * versioned component registered as grafana/folder-permissions/v2.
 *
 * props are partial because the registry types every exposed component as `ComponentType<{}>`; a
 * host that names no folder gets nothing rather than an error in its react tree.
 */
export function FolderPermissionsExposedComponentLazy(props: Partial<FolderPermissionsExposedComponentProps>) {
  if (!props.folderUid) {
    return null;
  }

  return (
    <Suspense fallback={<PermissionsLoading />}>
      {/* Remount for a new folder. The folder hook keeps returning the previous folder while the new one loads,
          which would leave the previous folder's permissions on screen. */}
      <FolderPermissionsExposedComponent key={props.folderUid} folderUid={props.folderUid} />
    </Suspense>
  );
}
