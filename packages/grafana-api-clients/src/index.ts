export { getAPINamespace, getAPIBaseURL, normalizeError, handleRequestError } from './utils/utils';
export { createBaseQuery } from './clients/rtkq/createBaseQuery';

/* @TODO figure out how to automatically set the MockBackendSrv when consumers of this package write tests using the exported clients */
export { MockBackendSrv } from './utils/backendSrv.mock';
