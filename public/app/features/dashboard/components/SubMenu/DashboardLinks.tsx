import { useEffectOnce } from 'react-use';

import { sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { selectors } from '@grafana/e2e-selectors';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { DashboardLink } from '@grafana/schema';
import { Tooltip, useForceUpdate } from '@grafana/ui';
import { LINK_ICON_MAP } from 'app/features/dashboard-scene/settings/links/utils';

import { getLinkSrv } from '../../../panel/panellinks/link_srv';
import { DashboardModel } from '../../state/DashboardModel';

import { DashboardLinkButton, DashboardLinksDashboard } from './DashboardLinksDashboard';

export interface Props {
  dashboard: DashboardModel;
  links: DashboardLink[];
}

export const DashboardLinks = ({ dashboard, links }: Props) => {
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
          return <DashboardLinksDashboard key={key} link={link} linkInfo={linkInfo} dashboardUID={dashboard.uid} />;
        }

        const icon = LINK_ICON_MAP[link.icon];

        const linkElement = (
          <DashboardLinkButton
            href={sanitizeUrl(linkInfo.href)}
            target={link.targetBlank ? '_blank' : undefined}
            rel="noreferrer"
            data-testid={selectors.components.DashboardLinks.link}
            icon={icon}
          >
            {linkInfo.title}
          </DashboardLinkButton>
        );

        return (
          <div key={key} data-testid={selectors.components.DashboardLinks.container}>
            {link.tooltip ? <Tooltip content={linkInfo.tooltip}>{linkElement}</Tooltip> : linkElement}
          </div>
        );
      })}
    </>
  );
};
