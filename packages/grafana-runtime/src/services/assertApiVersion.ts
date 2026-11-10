import { isValidApiVersion } from './pluginUtils';

export function assertApiVersion(apiVersion = ''): void {
  if (!isValidApiVersion(apiVersion)) {
    throw new Error('Invalid API version');
  }
}
