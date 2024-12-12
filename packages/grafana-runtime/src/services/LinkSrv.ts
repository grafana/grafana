import { DataLink, InterpolateFunction, LinkModel } from '@grafana/data';
import { DashboardLink } from '@grafana/schema';

export interface LinkService {
  getDataLinkUIModel: <T>(link: DataLink, replaceVariables: InterpolateFunction | undefined, origin: T) => LinkModel<T>;
  getAnchorInfo: (link: DashboardLink) => {
    href: string;
    title: string;
    tooltip: string;
  };
  getLinkUrl: (link: DashboardLink) => string;
}

let singleton: LinkService;

export function setLinkSrv(srv: LinkService) {
  singleton = srv;
}

export function getLinkSrv(): LinkService {
  return singleton;
}
