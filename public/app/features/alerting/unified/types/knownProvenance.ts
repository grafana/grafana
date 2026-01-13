import { PROVENANCE_NONE } from '../utils/k8s/constants';

export enum KnownProvenance {
  None = `${PROVENANCE_NONE}`,
  API = 'api',
  File = 'file',
  ConvertedPrometheus = 'converted_prometheus',
}
