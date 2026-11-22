import { config } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';

import { useGetResourceRepositoryView } from '../hooks/useGetResourceRepositoryView';
import {
  type ManagedResource,
  getManagerIdentity,
  getManagerKind,
  getSourcePath,
  isProvisioningResourceReadOnly,
} from '../utils/managedResource';

import { ManagedResourceBadge } from './ManagedResourceBadge';

interface Props {
  /** A resource `isManaged` reports as managed; its manager annotations decide the badge. */
  resource: ManagedResource;
  /** Whether the current user could otherwise edit. Only they need to know why they can't. */
  canEdit: boolean;
  /**
   * Set for resources Grafana writes back through the repository (dashboards, folders, playlists):
   * those are read-only only when the repository has no write workflow. Provisioning's own
   * configuration has no such flow, so whatever provisioned it is the only place to change it.
   */
  writesBackToRepository?: boolean;
}

/**
 * The managed badge for the page of a single managed resource, placed in the app chrome's
 * breadcrumb slot. Resolves the manager, its identity, the source path and whether the resource is
 * read-only from the resource itself, so every kind's page states the same thing the same way.
 */
export function ManagedResourceBreadcrumbBadge({ resource, canEdit, writesBackToRepository = false }: Props) {
  const managerKind = getManagerKind(resource);
  const managerId = getManagerIdentity(resource);
  // With provisioning off there is no repository to read a workflow from, so the manager's own
  // annotation decides instead (DashboardScene.isManagedRepository draws the same line).
  const isRepository = config.provisioningEnabled && managerKind === ManagerKind.Repo;
  const { isReadOnlyRepo } = useGetResourceRepositoryView({ name: isRepository ? managerId : undefined });

  const isReadOnly = writesBackToRepository && isRepository ? isReadOnlyRepo : isProvisioningResourceReadOnly(resource);

  return (
    <ManagedResourceBadge
      managerKind={managerKind}
      name={managerId}
      isReadOnly={canEdit && isReadOnly}
      repositoryName={managerId}
      sourcePath={getSourcePath(resource)}
    />
  );
}
