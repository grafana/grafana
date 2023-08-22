import { locationService } from '@grafana/runtime';

// Get callbackUrl from URL search params and validate it is a localhost URL
export function getCallbackUrl() {
  const params = locationService.getSearch();
  const callbackUrl = params.get('callbackUrl');

  if (!callbackUrl) {
    return null;
  }

  const url = new URL(callbackUrl);

  if (url.hostname !== 'localhost') {
    return null;
  }

  return callbackUrl;
}
