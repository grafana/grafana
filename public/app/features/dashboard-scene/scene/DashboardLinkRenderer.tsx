import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { sanitizeUrl } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { type DashboardLink } from '@grafana/schema';
import { MenuItem, Tooltip, useElementSelection, useStyles2 } from '@grafana/ui';
import {
  DashboardLinkButton,
  DashboardLinksDashboard,
} from 'app/features/dashboard/components/SubMenu/DashboardLinksDashboard';
import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

import { linkSelectionId } from '../settings/links/LinkAddEditableElement';
import { LINK_ICON_MAP } from '../settings/links/utils';

export interface Props {
  link: DashboardLink;
  dashboardUID: string;
  inMenu?: boolean;
  linkIndex?: number;
}

export function DashboardLinkRenderer({ link, dashboardUID, inMenu, linkIndex }: Props) {
  const linkInfo = getLinkSrv().getAnchorInfo(link);
  const styles = useStyles2(getStyles);
  const selectionId = linkIndex != null && linkIndex >= 0 ? linkSelectionId(linkIndex) : undefined;
  const { isSelected } = useElementSelection(selectionId);

  let content: React.ReactNode;
  if (link.type === 'dashboards') {
    content = <DashboardLinksDashboard link={link} linkInfo={linkInfo} dashboardUID={dashboardUID} />;
  } else {
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
    content = link.tooltip ? <Tooltip content={linkInfo.tooltip}>{linkElement}</Tooltip> : linkElement;
  }

  const containerClassName = cx(styles.linkContainer, isSelected && 'dashboard-selected-element');

  return (
    <div className={containerClassName} data-testid={selectors.components.DashboardLinks.container}>
      {content}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    linkContainer: css({
      display: 'inline-flex',
      alignItems: 'center',
      verticalAlign: 'middle',
      lineHeight: 1,
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    }),
  };
}
