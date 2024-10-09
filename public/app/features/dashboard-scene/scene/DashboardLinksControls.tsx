import { useEffect, useState } from 'react';

import { sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { selectors } from '@grafana/e2e-selectors';
import { SceneTimeRangeLike } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { Tooltip } from '@grafana/ui';
import {
  DashboardLinkButton,
  DashboardLinksDashboard,
} from 'app/features/dashboard/components/SubMenu/DashboardLinksDashboard';
import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

import { LINK_ICON_MAP } from '../settings/links/utils';

export interface Props {
  links: DashboardLink[];
  timeRange: SceneTimeRangeLike;
  uid?: string;
}

interface LinkInfo {
  href: string;
  title: string;
  tooltip: string;
}

export function DashboardLinksControls({ links, uid, timeRange }: Props) {
  const timeRangeState = timeRange.useState();
  const [linkInfos, setLinkInfos] = useState<Record<string, LinkInfo>>({});

  useEffect(() => {
    const newLinkInfo: Record<string, LinkInfo> = {};

    links.forEach((link: DashboardLink) => {
      newLinkInfo[link.title] = getLinkSrv().getAnchorInfo(link);
    });

    setLinkInfos(newLinkInfo);
  }, [links, timeRangeState.value]);

  if (!links || !uid) {
    return null;
  }

  return (
    <>
      {links.map((link: DashboardLink, index: number) => {
        const linkInfo = linkInfos[link.title] ?? getLinkSrv().getAnchorInfo(link);
        const key = `${link.title}-$${index}`;

        if (link.type === 'dashboards') {
          return <DashboardLinksDashboard key={key} link={link} linkInfo={linkInfo} dashboardUID={uid} />;
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
          <div key={key} data-testid={selectors.components.DashboardLinks.container}>
            {link.tooltip ? <Tooltip content={linkInfo.tooltip}>{linkElement}</Tooltip> : linkElement}
          </div>
        );
      })}
    </>
  );
}
