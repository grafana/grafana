import { BASE_PATH } from '../constants';
import { AuthProviderInfo } from '../types';

export function getProviderUrl(provider: AuthProviderInfo) {
  return BASE_PATH + (provider.configPath || provider.id);
}

export const isUrlValid = (url: unknown): boolean => {
  if (typeof url !== 'string') {
    return false;
  }
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol.includes('http');
  } catch (_) {
    return false;
  }
};

export const isValidDomain = (domain: string): boolean => {
  if (typeof domain !== 'string' || !domain.length) {
    return false;
  }

  const domainRegex =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,6}$/;
  return domainRegex.test(domain);
};
