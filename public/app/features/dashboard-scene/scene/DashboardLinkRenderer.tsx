import { sanitizeUrl } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { DashboardLink } from '@grafana/schema';
import { Tooltip } from '@grafana/ui';
import {
  DashboardLinkButton,
  DashboardLinksDashboard,
} from 'app/features/dashboard/components/SubMenu/DashboardLinksDashboard';
import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

import { LINK_ICON_MAP } from '../settings/links/utils';

export interface Props {
  link: DashboardLink;
  dashboardUID: string;
}

export function DashboardLinkRenderer({ link, dashboardUID }: Props) {
  const linkInfo = getLinkSrv().getAnchorInfo(link);

  if (link.type === 'dashboards') {
    return <DashboardLinksDashboard link={link} linkInfo={linkInfo} dashboardUID={dashboardUID} />;
  }

  const icon = LINK_ICON_MAP[link.icon];

  const linkElement = (
    <DashboardLinkButton
      icon={icon}
      href={sanitizeUrl(linkInfo.href)}
      target={link.targetBlank ? '_blank' : undefined}
      rel="noreferrer"
      data-testid={selectors.components.DashboardLinks.link}
    >
      {linkInfo.title}
    </DashboardLinkButton>
  );

  return (
    <div data-testid={selectors.components.DashboardLinks.container}>
      {link.tooltip ? <Tooltip content={linkInfo.tooltip}>{linkElement}</Tooltip> : linkElement}
    </div>
  );
}
