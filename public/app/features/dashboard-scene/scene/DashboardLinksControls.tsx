import React from 'react';

import { sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { Tooltip } from '@grafana/ui';
import {
  DashboardLinkButton,
  DashboardLinksDashboard,
} from 'app/features/dashboard/components/SubMenu/DashboardLinksDashboard';
import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

import { LINK_ICON_MAP } from '../settings/links/utils';
import { getDashboardSceneFor } from '../utils/utils';

interface DashboardLinksControlsState extends SceneObjectState {}

export class DashboardLinksControls extends SceneObjectBase<DashboardLinksControlsState> {
  static Component = DashboardLinksControlsRenderer;
}

function DashboardLinksControlsRenderer({ model }: SceneComponentProps<DashboardLinksControls>) {
  const { links, uid } = getDashboardSceneFor(model).useState();

  if (!links || !uid) {
    return null;
  }

  return (
    <>
      {links.map((link: DashboardLink, index: number) => {
        const linkInfo = getLinkSrv().getAnchorInfo(link);
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
