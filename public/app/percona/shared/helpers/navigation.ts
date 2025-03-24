import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

export const useLinkWithVariables = (url?: string) => {
  if (url && isDashboardUrl(url) && isDashboardUrl(window.location.pathname)) {
    const urlWithLinks = getLinkSrv().getLinkUrl({
      url: url,
      keepTime: true,
      // Check if the DB type matches the current one used
      includeVars: checkDbType(url),
      asDropdown: false,
      icon: '',
      tags: [],
      targetBlank: false,
      title: '',
      tooltip: '',
      type: 'link',
    });
    return cleanupVariables(urlWithLinks);
  } else {
    return url ? url : '#';
  }
};

const isDashboardUrl = (url?: string) => url?.includes('/d/');

const checkDbType = (url: string): boolean => {
  const currentDB = window.location.pathname?.split('/')[3]?.split('-')[0];
  const urlDB = url?.split('/')[3]?.split('-')[0];

  // enable variable sharing between same db types and db type -> os/node
  return (currentDB !== undefined && currentDB === urlDB) || urlDB === 'node';
};

const cleanupVariables = (urlWithLinks: string) => {
  const [base, params] = urlWithLinks.split('?');

  if (params) {
    // remove variables which have the All value or the value is empty
    const variables = params
      .split('&')
      .filter((param) => !(param.includes('All') || param.endsWith('=')))
      .join('&');

    return base + '?' + variables;
  }

  return base;
};
