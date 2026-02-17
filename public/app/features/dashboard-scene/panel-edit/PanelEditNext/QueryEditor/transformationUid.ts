import { v4 as uuidv4 } from 'uuid';

import { DataTransformerConfig } from '@grafana/data';

/**
 * Module-level WeakMap that associates each DataTransformerConfig object with a stable UUID.
 *
 * WeakMap is used so that entries are automatically garbage-collected when the config
 * object is no longer referenced, preventing memory leaks.
 */
const configUidMap = new WeakMap<DataTransformerConfig, string>();

/**
 * Returns a stable UUID for a given DataTransformerConfig.
 * If the config has not been seen before, a new UUID is generated and stored.
 */
export function getTransformationUid(config: DataTransformerConfig): string {
  let uid = configUidMap.get(config);
  if (!uid) {
    uid = uuidv4();
    configUidMap.set(config, uid);
  }
  return uid;
}

/**
 * Transfers the stable UUID from one config to another.
 *
 * Call this when a mutation creates a new config object that logically represents
 * the same transformation (e.g., toggling `disabled` via a spread). This ensures the
 * new object inherits the identity of the old one.
 */
export function transferTransformationUid(from: DataTransformerConfig, to: DataTransformerConfig): void {
  const uid = configUidMap.get(from);
  if (uid) {
    configUidMap.set(to, uid);
  }
}
