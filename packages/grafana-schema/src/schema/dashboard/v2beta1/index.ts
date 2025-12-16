// Re-export all types and values from types.spec.gen and types.status.gen for sub-path imports
// This allows imports like: import { Spec, Status } from '@grafana/schema/dashboard/v2beta1'
export * from './types.spec.gen';
export * from './types.status.gen';
