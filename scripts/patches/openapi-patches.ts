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
      description: 'Replace ReceiverIntegration with simple union (no discriminator to avoid TaggedUnion issues)',
      operations: [
        {
          op: 'replace',
          path: '/components/schemas/ReceiverIntegration',
          value: {
            oneOf: [
              { $ref: '#/components/schemas/EmailIntegration' },
              { $ref: '#/components/schemas/SlackIntegration' },
              { $ref: '#/components/schemas/OnCallIntegration' },
              { $ref: '#/components/schemas/UnknownIntegration' },
            ],
          },
        },
      ],
    },
    {
      description: 'Add discriminated integration schemas with type and settings',
      operations: [
        {
          op: 'add',
          path: '/components/schemas/EmailIntegration',
          value: {
            type: 'object',
            properties: {
              disableResolveMessage: { type: 'boolean' },
              secureFields: {
                type: 'object',
                additionalProperties: { type: 'boolean', default: false },
              },
              type: { type: 'string', const: 'email' },
              uid: { type: 'string' },
              version: { type: 'string' },
              settings: {
                type: 'object',
                properties: {
                  singleEmail: { type: 'boolean' },
                  addresses: { type: 'string', description: 'Email addresses to send notifications to' },
                  message: { type: 'string' },
                  subject: { type: 'string' },
                },
                required: ['addresses'],
              },
            },
            required: ['type', 'version', 'settings'],
          },
        },
        {
          op: 'add',
          path: '/components/schemas/SlackIntegration',
          value: {
            type: 'object',
            properties: {
              disableResolveMessage: { type: 'boolean' },
              secureFields: {
                type: 'object',
                additionalProperties: { type: 'boolean', default: false },
              },
              type: { type: 'string', const: 'slack' },
              uid: { type: 'string' },
              version: { type: 'string' },
              settings: {
                type: 'object',
                properties: {
                  endpointUrl: { type: 'string' },
                  url: { type: 'string' },
                  recipient: { type: 'string' },
                  text: { type: 'string' },
                  title: { type: 'string' },
                  username: { type: 'string' },
                  icon_emoji: { type: 'string' },
                  icon_url: { type: 'string' },
                  mentionChannel: { type: 'string' },
                  mentionUsers: { type: 'string', description: 'Comma separated string of users to mention' },
                  mentionGroups: { type: 'string', description: 'Comma separated string of groups to mention' },
                  color: { type: 'string' },
                },
              },
            },
            required: ['type', 'version', 'settings'],
          },
        },
        {
          op: 'add',
          path: '/components/schemas/OnCallIntegration',
          value: {
            type: 'object',
            properties: {
              disableResolveMessage: { type: 'boolean' },
              secureFields: {
                type: 'object',
                additionalProperties: { type: 'boolean', default: false },
              },
              type: { type: 'string', const: 'OnCall' },
              uid: { type: 'string' },
              version: { type: 'string' },
              settings: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  httpMethod: { type: 'string', enum: ['POST', 'PUT'] },
                  maxAlerts: { type: 'integer' },
                  authorization_scheme: { type: 'string' },
                  authorization_credentials: { type: 'string' },
                  username: { type: 'string' },
                  password: { type: 'string' },
                  title: { type: 'string' },
                  message: { type: 'string' },
                },
                required: ['url'],
              },
            },
            required: ['type', 'version', 'settings'],
          },
        },
        {
          op: 'add',
          path: '/components/schemas/UnknownIntegration',
          value: {
            type: 'object',
            properties: {
              disableResolveMessage: { type: 'boolean' },
              secureFields: {
                type: 'object',
                additionalProperties: { type: 'boolean', default: false },
              },
              type: {
                type: 'string',
                description: 'Type of the receiver integration. Can be any string for extensibility.',
              },
              uid: { type: 'string' },
              version: { type: 'string' },
              settings: {
                type: 'object',
                additionalProperties: true,
                description: 'Generic settings for any integration type',
              },
            },
            required: ['type', 'version', 'settings'],
          },
        },
      ],
    },
    {
      description: 'Set Receiver.kind to always be "Receiver" constant',
      operations: [
        {
          op: 'replace',
          path: '/components/schemas/Receiver/properties/kind',
          value: {
            type: 'string',
            const: 'Receiver',
            description:
              'Kind is a string value representing the REST resource this object represents. Always "Receiver" for this type.',
          },
        },
        {
          op: 'replace',
          path: '/components/schemas/Receiver/required',
          value: ['metadata', 'spec', 'status', 'kind'],
        },
      ],
    },
    {
      description: 'Add specific annotation schemas for better type safety',
      operations: [
        {
          op: 'add',
          path: '/components/schemas/AlertingEntityMetadataAnnotations',
          value: {
            type: 'object',
            description: 'Common metadata annotations for alerting entities',
            properties: {
              'grafana.com/access/canAdmin': {
                type: 'string',
                enum: ['true', 'false'],
                description: 'Whether the user can administer this entity',
              },
              'grafana.com/access/canDelete': {
                type: 'string',
                enum: ['true', 'false'],
                description: 'Whether the user can delete this entity',
              },
              'grafana.com/access/canWrite': {
                type: 'string',
                enum: ['true', 'false'],
                description: 'Whether the user can write to this entity',
              },
              'grafana.com/provenance': {
                type: 'string',
                description: 'Used for provisioning to identify what system created the entity',
              },
            },
            additionalProperties: false,
          },
        },
        {
          op: 'add',
          path: '/components/schemas/ContactPointMetadataAnnotations',
          value: {
            allOf: [
              { $ref: '#/components/schemas/AlertingEntityMetadataAnnotations' },
              {
                type: 'object',
                description: 'Contact point specific metadata annotations',
                properties: {
                  'grafana.com/access/canReadSecrets': {
                    type: 'string',
                    enum: ['true', 'false'],
                    description: 'Whether the user can read secrets for this contact point',
                  },
                  'grafana.com/inUse/routes': {
                    type: 'string',
                    pattern: '^[0-9]+$',
                    description: 'Number of routes using this contact point',
                  },
                  'grafana.com/inUse/rules': {
                    type: 'string',
                    pattern: '^[0-9]+$',
                    description: 'Number of rules using this contact point',
                  },
                },
              },
            ],
          },
        },
      ],
    },
    {
      description: 'Create a specialized ObjectMeta for Receivers with ContactPointMetadataAnnotations',
      operations: [
        {
          op: 'add',
          path: '/components/schemas/ReceiverObjectMeta',
          value: {
            allOf: [
              { $ref: '#/components/schemas/ObjectMeta' },
              {
                type: 'object',
                properties: {
                  annotations: {
                    $ref: '#/components/schemas/ContactPointMetadataAnnotations',
                  },
                },
              },
            ],
          },
        },
        {
          op: 'replace',
          path: '/components/schemas/Receiver/properties/metadata',
          value: {
            default: {},
            allOf: [{ $ref: '#/components/schemas/ReceiverObjectMeta' }],
          },
        },
      ],
    },
  ],
};
