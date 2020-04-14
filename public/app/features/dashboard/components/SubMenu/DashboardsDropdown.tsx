import React, { PureComponent } from 'react';
import { getBackendSrv } from '../../../../core/services/backend_srv';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';
import { DashboardLink } from './DashboardLinks';
import { DashboardSearchHit } from '../../../../types';
import { Icon } from '@grafana/ui';
import { sanitize, sanitizeUrl } from '../../../../core/utils/text';

interface Props {
  link: DashboardLink;
  linkInfo: { title: string; href: string };
  dashboardId: any;
}

interface State {
  searchHits: DashboardSearchHit[];
}

export class DashboardsDropdown extends PureComponent<Props, State> {
  state = { searchHits: [] as DashboardSearchHit[] };
  onDropDownClick = async () => {
    const { dashboardId, link } = this.props;

    const limit = 7;
    const dashboards = await getBackendSrv().search({ tag: link.tags, limit });
    const processed = dashboards
      .filter(dash => dash.id !== dashboardId)
      .map(dash => {
        return {
          ...dash,
          url: getLinkSrv().getLinkUrl(dash),
        };
      });

    this.setState({
      searchHits: processed,
    });
  };

  render() {
    const { link, linkInfo } = this.props;
    const { searchHits } = this.state;

    return (
      <div className="gf-form">
        <a
          className="gf-form-label pointer"
          target={link.target}
          onClick={this.onDropDownClick}
          data-placement="bottom"
          data-toggle="dropdown"
        >
          <Icon name="bars" />
          <span>{linkInfo.title}</span>
        </a>
        <ul className="dropdown-menu pull-right" role="menu">
          {searchHits.length > 1 &&
            searchHits.map((dashboard: any, index: number) => {
              return (
                <li key={`${dashboard.id}-${index}`}>
                  <a href={sanitizeUrl(dashboard.url)} target={dashboard.target}>
                    {sanitize(dashboard.title)}
                  </a>
                </li>
              );
            })}
        </ul>
      </div>
    );
  }
}
