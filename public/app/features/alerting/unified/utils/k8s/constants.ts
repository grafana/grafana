/**
 * Name of the custom annotation label used in k8s APIs for us to discern if a given entity was provisioned
 * @deprecated Use {@link K8sAnnotations.Provenance} instead
 * */
export const PROVENANCE_ANNOTATION = 'grafana.com/provenance';

/** Value of {@link PROVENANCE_ANNOTATION} given for entities that were not provisioned */
export const PROVENANCE_NONE = 'none';

export enum K8sAnnotations {
  Provenance = 'grafana.com/provenance',

  /** Annotation key that indicates how many notification policy routes are using this entity */
  InUseRoutes = 'grafana.com/inUse/routes',
  /** Annotation key that indicates how many alert rules are using this entity */
  InUseRules = 'grafana.com/inUse/rules',

  /** Annotation key that indicates that the calling user is able to write (edit) this entity */
  AccessWrite = 'grafana.com/access/canWrite',
  /** Annotation key that indicates that the calling user is able to admin the permissions of this entity */
  AccessAdmin = 'grafana.com/access/canAdmin',
  /** Annotation key that indicates that the calling user is able to delete this entity */
  AccessDelete = 'grafana.com/access/canDelete',
}

/**
 * Special name that the K8S API expects to see/user for the root route in notification policies
 */
export const ROOT_ROUTE_NAME = 'user-defined';
