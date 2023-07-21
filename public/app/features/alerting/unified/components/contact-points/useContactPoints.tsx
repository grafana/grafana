/**
 * This hook will combine data from both the Alertmanager config
 * and (if available) it will also fetch the status from the Grafana Managed status endpoint
 */

import { NotifierType, NotifierStatus } from 'app/types';

// A Contact Point has 1 or more integrations
// each integration can have additional metadata assigned to it
export interface ContactPoint<T extends Notifier> {
  notifiers: T[];
}

interface Notifier {
  type: NotifierType;
}

// Grafana Managed contact points have receivers with additional diagnostics
export interface NotifierWithDiagnostics extends Notifier {
  status: NotifierStatus;
}

export function useContactPoints(AlertManagerSourceName: string) {}
