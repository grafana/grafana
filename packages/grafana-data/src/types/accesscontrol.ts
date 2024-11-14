/**
 * With RBAC, the backend will return additional access control metadata to objects.
 * These metadata will contain user permissions associated to a given resource.
 *
 * For example:
 * {
 *   accessControl: { "datasources:read": true, "datasources:write": true }
 * }
 */
export interface WithAccessControlMetadata {
  accessControl?: Record<string, boolean>;
}
