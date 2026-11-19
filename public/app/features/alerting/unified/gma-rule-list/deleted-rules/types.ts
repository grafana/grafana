import type { ObjectMeta } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

export interface DeletedRule {
  apiVersion: string;
  kind: string;
  metadata: ObjectMeta;
  spec: { title: string };
}

export interface RestoreResult {
  success: boolean;
  isConflict: boolean;
  error?: unknown;
}
