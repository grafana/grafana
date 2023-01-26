/**
 * A library containing most of the static shapes required by Grafana.
 *
 * @packageDocumentation
 */
export * from './veneer/common.types';
export * from './index.gen';
// Re-export duplicate types explicitly
export type { OrgRole } from './index.gen';
