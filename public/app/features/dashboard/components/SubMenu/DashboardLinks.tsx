import React, { FC } from 'react';
import { Icon, IconName, Tooltip, useForceUpdate } from '@grafana/ui';
import { sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { DashboardLinksDashboard } from './DashboardLinksDashboard';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';

import { DashboardModel } from '../../state';
import { DashboardLink } from '../../state/DashboardModel';
import { linkIconMap } from '../LinksSettings/LinkSettingsEdit';
import { useEffectOnce } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { TimeRangeUpdatedEvent } from 'app/types/events';

export interface Props {
  dashboard: DashboardModel;
  links: DashboardLink[];
}

export const DashboardLinks: FC<Props> = ({ dashboard, links }) => {
  const forceUpdate = useForceUpdate();

  useEffectOnce(() => {
    const sub = dashboard.events.subscribe(TimeRangeUpdatedEvent, forceUpdate);
    return () => sub.unsubscribe();
  });

  if (!links.length) {
    return null;
  }

  return (
    <>
      {links.map((link: DashboardLink, index: number) => {
        const linkInfo = getLinkSrv().getAnchorInfo(link);
        const key = `${link.title}-$${index}`;

        if (link.type === 'dashboards') {
          return <DashboardLinksDashboard key={key} link={link} linkInfo={linkInfo} dashboardId={dashboard.id} />;
        }

        const linkElement = (
          <a
            className="gf-form-label gf-form-label--dashlink"
            href={sanitizeUrl(linkInfo.href)}
            target={link.targetBlank ? '_blank' : undefined}
            rel="noreferrer"
            aria-label={selectors.components.DashboardLinks.link}
          >
            <Icon name={linkIconMap[link.icon] as IconName} style={{ marginRight: '4px' }} />
            <span>{linkInfo.title}</span>
          </a>
        );

        return (
          <div key={key} className="gf-form" aria-label={selectors.components.DashboardLinks.container}>
            {link.tooltip ? <Tooltip content={linkInfo.tooltip}>{linkElement}</Tooltip> : linkElement}
          </div>
        );
      })}
    </>
  );
};
