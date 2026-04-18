export { getAPINamespace, getAPIBaseURL, normalizeError, handleRequestError } from './utils/utils';

/* @TODO figure out how to automatically set the MockBackendSrv when consumers of this package write tests using the exported clients */
export { MockBackendSrv } from './utils/backendSrv.mock';
