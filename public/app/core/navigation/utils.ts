import { createLogger } from '@grafana/ui';
import { KioskUrlValue } from '../../types';

export const navigationLogger = createLogger('Router');

export function queryStringToJSON(queryString: string) {
  const params: Array<[string, string | boolean]> = [];
  new URLSearchParams(queryString).forEach((v, k) => params.push([k, parseValue(v)]));
  return Object.fromEntries(new Map(params));
}

export function parseValue(value: string) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

export function shouldForceReload(query: string) {
  const params = new URLSearchParams(query);
  const forceLoginParam = params.get('forceLogin');

  if (forceLoginParam !== null && parseValue(forceLoginParam)) {
    return true;
  }

  return false;
}

export function setViewModeBodyClass(mode: KioskUrlValue) {
  const viewModeClasses = ['view-mode--tv', 'view-mode--kiosk', 'view-mode--inactive'];
  viewModeClasses.forEach((c) => document.body.classList.remove(c));

  switch (mode) {
    case 'tv': {
      document.body.classList.add('view-mode--tv');
      break;
    }
    // 1 & true for legacy states
    case '1':
    case true: {
      document.body.classList.add('view-mode--kiosk');
      break;
    }
  }
}
