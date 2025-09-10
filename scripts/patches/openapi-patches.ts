import { SpecPatches } from './types';

/**
 * Patches to apply to OpenAPI specs for type narrowing.
 * Keep all patches in this single location for easy auditing.
 *
 * Uses JSON Patch (RFC 6902) operations for precise modifications.
 *
 * To add a new patch:
 * 1. Find the spec filename (without .json extension)
 * 2. Add a new SchemaPatch object with:
 *    - operations: Array of JSON Patch operations
 *    - description: Human-readable description of what the patch does
 *
 * JSON Patch operations:
 * - "add": Add a new property
 * - "replace": Replace an existing property value
 * - "remove": Remove a property
 * - "copy": Copy a value from one location to another
 * - "move": Move a value from one location to another
 * - "test": Test that a value at a path equals a specific value
 *
 * Example:
 *   {
 *     operations: [
 *       { op: 'replace', path: '/components/schemas/MyType/properties/status/type', value: 'string' },
 *       { op: 'add', path: '/components/schemas/MyType/properties/status/enum', value: ['active', 'inactive'] }
 *     ],
 *     description: 'Narrow MyType.status to specific values'
 *   }
 */
export const SPEC_PATCHES: SpecPatches = {
  'notifications.alerting.grafana.app-v0alpha1': [
    {
      description: 'Narrow RoutingTreeMatcher.type to specific matcher operators',
      operations: [
        {
          op: 'add',
          path: '/components/schemas/RoutingTreeMatcher/properties/type/enum',
          value: ['=', '!=', '=~', '!~'],
        },
        { op: 'replace', path: '/components/schemas/RoutingTreeMatcher/properties/type/default', value: '=' },
      ],
    },
    {
      description: 'Make ReceiverIntegration.settings explicitly Record<string, unknown>',
      operations: [
        {
          op: 'replace',
          path: '/components/schemas/ReceiverIntegration/properties/settings/additionalProperties',
          value: true,
        },
        {
          op: 'add',
          path: '/components/schemas/ReceiverIntegration/properties/settings/description',
          value: 'Settings for the receiver integration',
        },
      ],
    },
  ],
};
