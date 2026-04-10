import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { isAdmin } from '../../utils/misc';

import {
  type AbilityState,
  type AbilityStates,
  EnrichmentAction,
  FolderBulkAction,
  Granted,
  InsufficientPermissions,
  NotSupported,
} from './types';

// ── Folder bulk action abilities ──────────────────────────────────────────────

export function useFolderBulkActionAbilityStates(): AbilityStates<FolderBulkAction> {
  const admin = isAdmin();
  return useMemo(
    () => ({
      [FolderBulkAction.Pause]: admin ? Granted : InsufficientPermissions([]),
      [FolderBulkAction.Delete]: admin ? Granted : InsufficientPermissions([]),
    }),
    [admin]
  );
}

export function useFolderBulkActionAbilityState(action: FolderBulkAction): AbilityState {
  const all = useFolderBulkActionAbilityStates();
  return useMemo(() => all[action], [all, action]);
}

// ── Enrichment abilities ──────────────────────────────────────────────────────

export function useEnrichmentAbilityStates(): AbilityStates<EnrichmentAction> {
  const userIsAdmin = isAdmin();
  const hasReadPermission = ctx.hasPermission(AccessControlAction.AlertingEnrichmentsRead);
  const hasWritePermission = ctx.hasPermission(AccessControlAction.AlertingEnrichmentsWrite);
  const supported = Boolean(config.featureToggles.alertEnrichment);

  return useMemo(() => {
    const readAllowed = userIsAdmin || hasReadPermission;
    const writeAllowed = userIsAdmin || hasWritePermission;

    function enrichmentState(allowed: boolean, permission: AccessControlAction): AbilityState {
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

export function useEnrichmentAbilityState(action: EnrichmentAction): AbilityState {
  const all = useEnrichmentAbilityStates();
  return useMemo(() => all[action], [all, action]);
}
