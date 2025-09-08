import { config } from '../config';

/**
 * Returns true if the current instance is using the frontend-service.
 * @internal
 */
export function isFrontendService() {
  return config.bootData._femt;
}
