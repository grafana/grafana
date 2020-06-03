import React, { FC } from 'react';
import { Icon, IconName, Tooltip } from '@grafana/ui';
import { sanitize, sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { DashboardLinksDashboard } from './DashboardLinksDashboard';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';

import { DashboardModel } from '../../state';
import { DashboardLink } from '../../state/DashboardModel';
import { iconMap } from '../DashLinks/DashLinksEditorCtrl';

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

          if (link.type === 'dashboards') {
            return <DashboardLinksDashboard key={key} link={link} linkInfo={linkInfo} dashboardId={dashboard.id} />;
          }

          const linkElement = (
            <a
              className="gf-form-label"
              href={sanitizeUrl(linkInfo.href)}
              target={link.targetBlank ? '_blank' : '_self'}
            >
              <Icon name={iconMap[link.icon] as IconName} style={{ marginRight: '4px' }} />
              <span>{sanitize(linkInfo.title)}</span>
            </a>
          );

          return (
            <div key={key} className="gf-form">
              {link.tooltip ? <Tooltip content={link.tooltip}>{linkElement}</Tooltip> : linkElement}
            </div>
          );
        })}
      </>
    )
  );
};
