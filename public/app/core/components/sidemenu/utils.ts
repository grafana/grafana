import { getConfig } from 'app/core/config';

export const getForcedLoginUrl = (url: string) => {
  const urlObj = new URL(`${getConfig().appSubUrl}${url}`, getConfig().appUrl);
  let params = urlObj.searchParams;
  params.set('forceLogin', 'true');
  return urlObj.toString();
};
