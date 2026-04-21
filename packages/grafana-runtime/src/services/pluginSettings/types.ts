import { type PluginMeta, type KeyValue } from '@grafana/data';

import type { Spec as v0alpha1Spec } from '../pluginMeta/types/meta/types.spec.gen';

interface UpdateInlineSecureValue {
  /**
   * Update an existing secure value.
   * - On PUT (write): the new plaintext to store for this key.
   * - On GET (read): a redacted server-generated reference
   *   — never the plaintext. Treat as opaque.
   */
  name: string;
}

interface CreateInlineSecureValue {
  /** PUT-only: plaintext for a secure value that does not yet exist. */
  create: string;
  /** PUT-only: optional description stored alongside the new value. */
  description?: string;
}

interface DeleteInlineSecureValue {
  /** PUT-only: delete this secure value on the server. */
  remove: true;
}

/**
 * Inline secure value for a plugin settings PUT body. The server expects
 * exactly one of `name`, `create`, or `remove` to be set per key. TypeScript
 * cannot enforce this — callers must pick one variant.
 *
 * The shape is also what the server returns on GET; see per-field docs for
 * how each field's meaning differs between read and write.
 */
export type InlineSecureValue = UpdateInlineSecureValue | CreateInlineSecureValue | DeleteInlineSecureValue;

/** Map of secure-value keys to their inline values. */
export type InlineSecureValues = Record<string, InlineSecureValue>;

interface ObjectMeta {
  name: string;
  namespace: string;
}

export interface SettingsSpec<T extends KeyValue = {}> {
  enabled: boolean;
  pinned: boolean;
  jsonData: T;
}

export interface Settings {
  apiVersion: string;
  kind: 'Settings';
  metadata: ObjectMeta;
  spec: SettingsSpec;
  secure?: InlineSecureValues;
}

export type SettingsMapper = (spec: v0alpha1Spec, settings: Settings) => PluginMeta;
