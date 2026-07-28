import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { isAdmin } from '../../utils/misc';

import {
  type Abilities,
  type Ability,
  EnrichmentAction,
  FolderAction,
  FolderBulkAction,
  Granted,
  InsufficientPermissions,
  NotSupported,
} from './types';

// ── Folder abilities ──────────────────────────────────────────────────────────

/**
 * This hooks fetches all computed folder abilities for the logged in user
 * @lintignore
 */
export function useFolderAbilities(): Abilities<FolderAction> {
  const canCreate = ctx.hasPermission(AccessControlAction.FoldersCreate);
  return useMemo(
    () => ({
      [FolderAction.Create]: canCreate ? Granted : InsufficientPermissions([AccessControlAction.FoldersCreate]),
    }),
    [canCreate]
  );
}

export function useFolderAbility(action: FolderAction): Ability {
  const all = useFolderAbilities();
  return useMemo(() => all[action], [all, action]);
}

// ── Folder bulk action abilities ──────────────────────────────────────────────

export function useFolderBulkActionAbilities(): Abilities<FolderBulkAction> {
  const admin = isAdmin();
  return useMemo(
    () => ({
      // TODO: replace InsufficientPermissions([]) with an INSUFFICIENT_ROLE cause once the
      // Ability discriminated union gains that variant. Empty anyOfPermissions currently
      // renders as "Requires: " with nothing after it — misleading for role-gated actions.
      [FolderBulkAction.Pause]: admin ? Granted : InsufficientPermissions([]),
      [FolderBulkAction.Delete]: admin ? Granted : InsufficientPermissions([]),
    }),
    [admin]
  );
}

export function useFolderBulkActionAbility(action: FolderBulkAction): Ability {
  const all = useFolderBulkActionAbilities();
  return useMemo(() => all[action], [all, action]);
}

// ── Enrichment abilities ──────────────────────────────────────────────────────

export function useEnrichmentAbilities(): Abilities<EnrichmentAction> {
  const userIsAdmin = isAdmin();
  const hasReadPermission = ctx.hasPermission(AccessControlAction.AlertingEnrichmentsRead);
  const hasWritePermission = ctx.hasPermission(AccessControlAction.AlertingEnrichmentsWrite);
  const supported = Boolean(config.featureToggles.alertEnrichment);

  return useMemo(() => {
    const readAllowed = userIsAdmin || hasReadPermission;
    const writeAllowed = userIsAdmin || hasWritePermission;

    function enrichmentState(allowed: boolean, permission: AccessControlAction): Ability {
      if (!supported) {
        return NotSupported;
      }
      if (allowed) {
        return Granted;
      }
      return InsufficientPermissions([permission]);
    }

    return {
      [EnrichmentAction.Read]: enrichmentState(readAllowed, AccessControlAction.AlertingEnrichmentsRead),
      [EnrichmentAction.Write]: enrichmentState(writeAllowed, AccessControlAction.AlertingEnrichmentsWrite),
    };
  }, [userIsAdmin, hasReadPermission, hasWritePermission, supported]);
}

export function useEnrichmentAbility(action: EnrichmentAction): Ability {
  const all = useEnrichmentAbilities();
  return useMemo(() => all[action], [all, action]);
}
