import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { sanitizeUrl } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { DashboardLink } from '@grafana/schema';
import { MenuItem, Tooltip, useStyles2 } from '@grafana/ui';
import {
  DashboardLinkButton,
  DashboardLinksDashboard,
} from 'app/features/dashboard/components/SubMenu/DashboardLinksDashboard';
import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

import { LINK_ICON_MAP } from '../settings/links/utils';

export interface Props {
  link: DashboardLink;
  dashboardUID: string;
  // Set to `true` if displaying a link in a drop-down menu (e.g. dashboard controls)
  inMenu?: boolean;
}

export function DashboardLinkRenderer({ link, dashboardUID, inMenu }: Props) {
  const linkInfo = getLinkSrv().getAnchorInfo(link);
  const styles = useStyles2(getStyles);

  if (link.type === 'dashboards') {
    return <DashboardLinksDashboard link={link} linkInfo={linkInfo} dashboardUID={dashboardUID} />;
  }

  const icon = LINK_ICON_MAP[link.icon];

  const linkElement = inMenu ? (
    <MenuItem
      icon={icon}
      url={sanitizeUrl(linkInfo.href)}
      label={linkInfo.title}
      target={link.targetBlank ? '_blank' : undefined}
      data-testid={selectors.components.DashboardLinks.link}
    />
  ) : (
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
    <div className={styles.linkContainer} data-testid={selectors.components.DashboardLinks.container}>
      {link.tooltip ? <Tooltip content={linkInfo.tooltip}>{linkElement}</Tooltip> : linkElement}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    linkContainer: css({
      display: 'inline-flex',
      alignItems: 'center',
      verticalAlign: 'middle',
      marginBottom: theme.spacing(1),
    }),
  };
}
