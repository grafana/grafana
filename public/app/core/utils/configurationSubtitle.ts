import type { ReactNode } from 'react';

import { contextSrv } from 'app/core/services/context_srv';

const ORG_SUBTITLE_PREFIX = 'Organization:';

export function getConfigurationSubtitle(orgName: string): string {
  if (contextSrv.user.orgCount <= 1) {
    return '';
  }

  return `${ORG_SUBTITLE_PREFIX} ${orgName}`;
}

export function shouldShowConfigurationSubtitle(subTitle?: ReactNode): boolean {
  if (!subTitle) {
    return false;
  }

  if (contextSrv.user.orgCount <= 1 && typeof subTitle === 'string' && subTitle.startsWith(ORG_SUBTITLE_PREFIX)) {
    return false;
  }

  return true;
}
