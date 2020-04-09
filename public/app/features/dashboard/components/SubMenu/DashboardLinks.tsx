import React, { PureComponent } from 'react';
import { DashboardModel } from '../../state';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';
import { Icon } from '@grafana/ui';
import { getBackendSrv } from '../../../../core/services/backend_srv';
import { DashboardsDropdown } from './DashboardsDropdown';

export interface Props {
  dashboard: DashboardModel;
}

type DashboardLinkType = 'link' | 'dashboards';

export interface DashboardLink {
  icon: string;
  title: string;
  tooltip: string;
  type: DashboardLinkType;
  url: string;
  asDropdown: boolean;
  tags: [];
  searchHits?: [];
}

export class DashboardLinks extends PureComponent<Props> {
  onDropDownClick = async (link: DashboardLink) => {
    const { dashboard } = this.props;

    const limit = 7;
    const dashboards = await getBackendSrv().search({ tag: link.tags, limit });
    const processed = dashboards
      .filter(dash => dash.id !== dashboard.id)
      .map(dash => {
        return {
          ...dash,
          url: getLinkSrv().getLinkUrl(dash),
        };
      });
    return processed;
  };

  render() {
    const { dashboard } = this.props;
    return dashboard.links.length > 0 ? (
      <>
        {dashboard.links.map((link: DashboardLink, index: number) => {
          const linkInfo = getLinkSrv().getAnchorInfo(link);
          const key = `${link.title}-$${index}`;

          if (link.asDropdown) {
            return <DashboardsDropdown key={key} link={link} linkInfo={linkInfo} dashboardId={dashboard.id} />;
          }

          return (
            <div key={key} className="gf-form">
              <a className="gf-form-label" href={linkInfo.href} target={link.target}>
                <Icon name={`${link.icon.replace(' ', '-')}`} />
                <span>{linkInfo.title}</span>
              </a>
            </div>
          );
        })}
      </>
    ) : null;
  }
}
