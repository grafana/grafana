import { difference } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useDeepCompareEffect } from 'react-use';
import useAsync from 'react-use/lib/useAsync';

import { Permission, RoleDto } from '@grafana/api-clients/rtkq/legacy';
import { OrgRole } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { Role, AccessControlAction } from 'app/types/accessControl';

import { fetchRoleOptions } from './api';

/**
 * Maps a basic role name to its API UID for fetching details.
 */
const basicRoleUidMap: Record<string, string> = {
  [OrgRole.Viewer]: 'basic_viewer',
  [OrgRole.Editor]: 'basic_editor',
  [OrgRole.Admin]: 'basic_admin',
  [OrgRole.None]: 'basic_none',
};

/**
 * Official basic role → fixed role name mapping from Grafana docs.
 * @see https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/
 *
 * These are cumulative: Editor includes Viewer roles, Admin includes Editor + Viewer roles.
 */
const VIEWER_FIXED_ROLES: string[] = [
  'fixed:datasources.id:reader',
  'fixed:organization:reader',
  'fixed:annotations:reader',
  'fixed:annotations.dashboard:writer',
  'fixed:alerting:reader',
  'fixed:plugins.app:reader',
  'fixed:dashboards.insights:reader',
  'fixed:datasources.insights:reader',
  'fixed:library.panels:general.reader',
  'fixed:folders.general:reader',
  'fixed:datasources.builtin:reader',
  'fixed:queries:reader',
];

const EDITOR_ADDITIONAL_ROLES: string[] = [
  'fixed:datasources:explorer',
  'fixed:dashboards:creator',
  'fixed:folders:creator',
  'fixed:annotations:writer',
  'fixed:alerting:writer',
  'fixed:library.panels:creator',
  'fixed:library.panels:general.writer',
  'fixed:alerting.provisioning.provenance:writer',
  'fixed:queries:writer',
];

const ADMIN_ADDITIONAL_ROLES: string[] = [
  'fixed:reports:writer',
  'fixed:datasources:writer',
  'fixed:organization:writer',
  'fixed:datasources.permissions:writer',
  'fixed:teams:writer',
  'fixed:dashboards:writer',
  'fixed:dashboards.permissions:writer',
  'fixed:dashboards.public:writer',
  'fixed:folders:writer',
  'fixed:folders.permissions:writer',
  'fixed:alerting.provisioning.secrets:reader',
  'fixed:alerting.provisioning:writer',
  'fixed:datasources.caching:writer',
  'fixed:plugins:writer',
  'fixed:library.panels:writer',
];

const basicRoleFixedRoleNames: Record<string, string[]> = {
  [OrgRole.Viewer]: VIEWER_FIXED_ROLES,
  [OrgRole.Editor]: [...VIEWER_FIXED_ROLES, ...EDITOR_ADDITIONAL_ROLES],
  [OrgRole.Admin]: [...VIEWER_FIXED_ROLES, ...EDITOR_ADDITIONAL_ROLES, ...ADMIN_ADDITIONAL_ROLES],
};

export interface InheritedRoleInfo {
  /** The role that is inherited (shown greyed out) */
  role: Role;
  /** Which source role(s) this is inherited from, e.g. "Viewer" or "Alerting Full Admin" */
  sources: string[];
}

/**
 * Fetches a role's full details including permissions.
 * Uses a simple in-memory cache since role definitions rarely change.
 */
const roleDetailCache = new Map<string, RoleDto>();

async function fetchRoleDetail(uid: string): Promise<RoleDto> {
  const cached = roleDetailCache.get(uid);
  if (cached) {
    return cached;
  }
  const result = await getBackendSrv().get<RoleDto>(`/api/access-control/roles/${uid}`);
  roleDetailCache.set(uid, result);
  return result;
}

export { fetchRoleDetail };

/**
 * Checks if a source permission covers a required permission.
 * Handles wildcard scopes: "receivers:*" covers "receivers:type:new".
 */
function permissionCovers(sourceAction: string, sourceScope: string, reqAction: string, reqScope: string): boolean {
  if (sourceAction !== reqAction) {
    return false;
  }
  if (sourceScope === reqScope) {
    return true;
  }
  // Wildcard: "receivers:*" covers "receivers:type:new"
  if (sourceScope.endsWith(':*')) {
    const prefix = sourceScope.slice(0, -1); // "receivers:"
    if (reqScope.startsWith(prefix) || reqScope === sourceScope.slice(0, -2)) {
      return true;
    }
  }
  // Global wildcard
  if (sourceScope === '*') {
    return true;
  }
  return false;
}

/**
 * Given a set of permissions, find which roles from roleOptions are fully covered
 * (i.e., every permission in the role is present in the permission set).
 * Supports wildcard scope matching (e.g., "receivers:*" covers "receivers:type:new").
 */
function findCoveredRoles(
  permissions: Permission[],
  roleOptions: Role[],
  roleDetailsMap: Map<string, RoleDto>
): Role[] {
  const covered: Role[] = [];
  for (const role of roleOptions) {
    const detail = roleDetailsMap.get(role.uid);
    if (!detail?.permissions?.length) {
      continue;
    }
    const allCovered = detail.permissions.every((reqPerm) => {
      const reqAction = reqPerm.action || '';
      const reqScope = reqPerm.scope || '';
      return permissions.some((srcPerm) =>
        permissionCovers(srcPerm.action || '', srcPerm.scope || '', reqAction, reqScope)
      );
    });
    if (allCovered) {
      covered.push(role);
    }
  }
  return covered;
}

/**
 * Find permissions that are not accounted for by any of the covered roles.
 * Uses wildcard-aware matching so "receivers:*" accounts for "receivers:type:new".
 */
function findOrphanPermissions(
  permissions: Permission[],
  coveredRoles: Role[],
  roleDetailsMap: Map<string, RoleDto>
): Permission[] {
  const rolePerms: Array<{ action: string; scope: string }> = [];
  for (const role of coveredRoles) {
    const detail = roleDetailsMap.get(role.uid);
    if (detail?.permissions) {
      for (const p of detail.permissions) {
        rolePerms.push({ action: p.action || '', scope: p.scope || '' });
      }
    }
  }
  return permissions.filter((p) => {
    const action = p.action || '';
    const scope = p.scope || '';
    return !rolePerms.some((rp) => permissionCovers(rp.action, rp.scope, action, scope));
  });
}

/**
 * Hook that computes which roles are "inherited" from the user's basic role
 * and assigned custom/plugin roles. Returns a map of role UID → source labels,
 * plus any orphan permissions not covered by named roles.
 */
export function useInheritedRoles(
  basicRole: OrgRole | undefined,
  appliedRoles: Role[],
  roleOptions: Role[]
): {
  inheritedRoles: Map<string, InheritedRoleInfo>;
  orphanPermissions: Permission[];
  isLoading: boolean;
} {
  const [inheritedRoles, setInheritedRoles] = useState<Map<string, InheritedRoleInfo>>(new Map());
  const [orphanPermissions, setOrphanPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const appliedRoleUids = useMemo(() => appliedRoles.map((r) => r.uid).sort().join(','), [appliedRoles]);

  useEffect(() => {
    let cancelled = false;

    const compute = async () => {
      // Bail out only if there's nothing to compute at all
      const hasBasicRole = basicRole && basicRole !== OrgRole.None;
      if (!hasBasicRole && appliedRoles.length === 0) {
        setInheritedRoles(new Map());
        setOrphanPermissions([]);
        return;
      }

      setIsLoading(true);

      try {
        const result = new Map<string, InheritedRoleInfo>();
        let allOrphanPermissions: Permission[] = [];

        // Shared across Steps 1.5 and 3
        const roleDetailsMap = new Map<string, RoleDto>();
        const candidateRoles = roleOptions.filter(
          (r) => r.name.startsWith('fixed:') || r.name.startsWith('plugins:')
        );

        // Steps 1 + 1.5 + 2: Only run if there's a non-None basic role
        if (hasBasicRole) {
          const basicRoleLabel = basicRole.charAt(0).toUpperCase() + basicRole.slice(1);

          // Build a name→role lookup from roleOptions for fast matching
          const roleByName = new Map<string, Role>();
          for (const role of roleOptions) {
            roleByName.set(role.name, role);
          }

          // Step 1: Use official docs mapping for basic role → fixed roles
          const officialRoleNames = basicRoleFixedRoleNames[basicRole] || [];
          const officiallyMappedRoles: Role[] = [];
          for (const roleName of officialRoleNames) {
            const role = roleByName.get(roleName);
            if (role) {
              result.set(role.uid, { role, sources: [basicRoleLabel] });
              officiallyMappedRoles.push(role);
            }
          }
          if (cancelled) {
            return;
          }

          // Step 2: Compute orphan permissions (basic role perms not covered by mapped roles)
          const basicRoleUid = basicRoleUidMap[basicRole];
          if (basicRoleUid) {
            const basicRoleDetail = await fetchRoleDetail(basicRoleUid);
            if (cancelled) {
              return;
            }
            const basicPermissions = basicRoleDetail.permissions || [];

            // Fetch details for the officially-mapped roles
            await Promise.all(
              officiallyMappedRoles.map(async (role) => {
                const detail = await fetchRoleDetail(role.uid);
                roleDetailsMap.set(role.uid, detail);
              })
            );
            if (cancelled) {
              return;
            }

            // Step 1.5: Match basic role permissions against plugin roles
            await Promise.all(
              candidateRoles.map(async (role) => {
                if (!roleDetailsMap.has(role.uid)) {
                  const detail = await fetchRoleDetail(role.uid);
                  roleDetailsMap.set(role.uid, detail);
                }
              })
            );
            if (cancelled) {
              return;
            }

            // Find plugin roles covered by basic role permissions
            const pluginCandidates = candidateRoles.filter(
              (r) => r.name.startsWith('plugins:') && !result.has(r.uid)
            );
            const coveredPluginRoles = findCoveredRoles(basicPermissions, pluginCandidates, roleDetailsMap);
            for (const role of coveredPluginRoles) {
              result.set(role.uid, { role, sources: [basicRoleLabel] });
            }

            // Compute orphans against ALL mapped roles (official fixed + matched plugin)
            const allMappedRoles = [...officiallyMappedRoles, ...coveredPluginRoles];
            allOrphanPermissions = findOrphanPermissions(basicPermissions, allMappedRoles, roleDetailsMap);
          }
        }

        if (cancelled) {
          return;
        }

        // Step 3: For each applied (custom/plugin) role, use permission-based matching
        // This runs independently of basic role — enables teams view to show inherited roles
        if (appliedRoles.length > 0) {
          // Ensure candidate role details are fetched (may already be done in Step 1.5)
          await Promise.all(
            candidateRoles.map(async (role) => {
              if (!roleDetailsMap.has(role.uid)) {
                const detail = await fetchRoleDetail(role.uid);
                roleDetailsMap.set(role.uid, detail);
              }
            })
          );
          if (cancelled) {
            return;
          }

          for (const appliedRole of appliedRoles) {
            const appliedDetail = await fetchRoleDetail(appliedRole.uid);
            const appliedPermissions = appliedDetail.permissions || [];
            if (!appliedPermissions.length) {
              continue;
            }

            const coveredByApplied = findCoveredRoles(appliedPermissions, candidateRoles, roleDetailsMap);
            const sourceLabel = appliedRole.displayName || appliedRole.name;

            for (const role of coveredByApplied) {
              if (role.uid === appliedRole.uid) {
                continue;
              }
              const existing = result.get(role.uid);
              if (existing) {
                if (!existing.sources.includes(sourceLabel)) {
                  existing.sources.push(sourceLabel);
                }
              } else {
                result.set(role.uid, { role, sources: [sourceLabel] });
              }
            }

            const appliedOrphans = findOrphanPermissions(appliedPermissions, coveredByApplied, roleDetailsMap);
            const existingOrphanKeys = new Set(allOrphanPermissions.map((p) => `${p.action}|${p.scope}`));
            for (const orphan of appliedOrphans) {
              const key = `${orphan.action}|${orphan.scope}`;
              if (!existingOrphanKeys.has(key)) {
                allOrphanPermissions.push(orphan);
                existingOrphanKeys.add(key);
              }
            }
          }
        }

        if (!cancelled) {
          console.log('[Permission Lens] Inherited roles computed:', result.size, 'roles');
          result.forEach((info, uid) => {
            console.log(`  [Inherited] ${info.role.displayName || info.role.name} (uid: ${uid}) ← ${info.sources.join(', ')}`);
          });
          console.log('[Permission Lens] Orphan permissions:', allOrphanPermissions.length);
          setInheritedRoles(result);
          setOrphanPermissions(allOrphanPermissions);
        }
      } catch (error) {
        console.error('Failed to compute inherited roles:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    compute();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basicRole, appliedRoleUids, roleOptions]);

  return { inheritedRoles, orphanPermissions, isLoading };
}

type MultiOrgRoleOptions = Record<number, Role[]>;

export const useRoleOptions = (organizationId: number) => {
  const [orgId, setOrgId] = useState(organizationId);

  const { value = [] } = useAsync(async () => {
    if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
      return fetchRoleOptions(orgId);
    }
    return Promise.resolve([]);
  }, [orgId]);

  return [{ roleOptions: value }, setOrgId] as const;
};

export const useMultiOrgRoleOptions = (orgIDs: number[]): MultiOrgRoleOptions => {
  const [orgRoleOptions, setOrgRoleOptions] = useState<MultiOrgRoleOptions>({});

  useDeepCompareEffect(() => {
    if (!contextSrv.licensedAccessControlEnabled() || !contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
      return;
    }

    const currentOrgIDs = Object.keys(orgRoleOptions).map((o) => (typeof o === 'number' ? o : parseInt(o, 10)));
    const newOrgIDs = difference(orgIDs, currentOrgIDs);

    Promise.all(
      newOrgIDs.map((orgID) => {
        return fetchRoleOptions(orgID).then((roleOptions) => [orgID, roleOptions]);
      })
    ).then((value) => {
      setOrgRoleOptions({
        ...orgRoleOptions,
        ...Object.fromEntries(value),
      });
    });
  }, [orgIDs]);

  return orgRoleOptions;
};
