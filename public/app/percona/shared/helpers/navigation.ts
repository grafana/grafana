import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

export const useLinkWithVariables = (url?: string) => {
  if (url?.match('/d/')) {
    return getLinkSrv().getLinkUrl({
      url: url,
      keepTime: true,
      // Check if the DB type matches the current one used
      includeVars: checkDbType(url),
    });
  } else {
    return url ? url : '#';
  }
};

const checkDbType = (url: string): boolean => {
  const currentDB = window.location.pathname.split('/')[3].split('-')[0];
  const urlDB = url.split('/')[3].split('-')[0];

  return currentDB === urlDB;
};
