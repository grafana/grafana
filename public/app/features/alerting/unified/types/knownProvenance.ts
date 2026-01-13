export enum KnownProvenance {
  None = 'none' /** Value of {@link PROVENANCE_ANNOTATION} given for entities that were not provisioned */,
  API = 'api',
  File = 'file',
  ConvertedPrometheus = 'converted_prometheus',
}
