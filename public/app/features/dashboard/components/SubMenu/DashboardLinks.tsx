import React, { FC } from 'react';
import { Icon, IconName } from '@grafana/ui';
import { sanitize, sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { DashboardsDropdown } from './DashboardsDropdown';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';

import { DashboardModel } from '../../state';
import { DashboardLink } from '../../state/DashboardModel';

export interface Props {
  dashboard: DashboardModel;
}

export const DashboardLinks: FC<Props> = ({ dashboard }) => {
  return (
    dashboard.links.length > 0 && (
      <>
        {dashboard.links.map((link: DashboardLink, index: number) => {
          const linkInfo = getLinkSrv().getAnchorInfo(link);
          const key = `${link.title}-$${index}`;

          if (link.asDropdown) {
            return <DashboardsDropdown key={key} link={link} linkInfo={linkInfo} dashboardId={dashboard.id} />;
          }

          return (
            <div key={key} className="gf-form">
              <a className="gf-form-label" href={sanitizeUrl(linkInfo.href)} target={link.target}>
                <Icon name={`${link.icon.replace(' ', '-')}` as IconName} />
                <span>{sanitize(linkInfo.title)}</span>
              </a>
            </div>
          );
        })}
      </>
    )
  );
};
