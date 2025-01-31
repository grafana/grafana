import { getAPINamespace } from '../../../api/utils';

/**
 * @alpha
 */
export const API_VERSION = 'peakq.grafana.app/v0alpha1';

/**
 * @alpha
 */
export enum QueryTemplateKinds {
  QueryTemplate = 'QueryTemplate',
}

/**
 * Query Library is an experimental feature. API (including the URL path) will likely change.
 *
 * @alpha
 */
export const BASE_URL = `/apis/${API_VERSION}/namespaces/${getAPINamespace()}`;
