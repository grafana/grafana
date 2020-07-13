import { getConfig } from 'app/core/config';

export const getForcedLoginUrl = (url: string) => {
  return `${getConfig().appSubUrl}${url}&forceLogin=true`;
};
