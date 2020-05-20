import React, { PureComponent } from 'react';
import { Icon, Tooltip } from '@grafana/ui';
import { sanitize, sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';
import { DashboardLink } from '../../state/DashboardModel';
import { DashboardSearchHit } from 'app/features/search/types';

interface Props {
  link: DashboardLink;
  linkInfo: { title: string; href: string };
  dashboardId: any;
}

interface State {
  searchHits: DashboardSearchHit[];
}

export class DashboardLinksDashboard extends PureComponent<Props, State> {
  state = { searchHits: [] as DashboardSearchHit[] };
  componentDidMount() {
    if (!this.props.link.asDropdown) {
      this.onDropDownClick();
    }
  }

  onDropDownClick = () => {
    const { dashboardId, link } = this.props;

    const limit = 7;
    getBackendSrv()
      .search({ tag: link.tags, limit })
      .then((dashboards: DashboardSearchHit[]) => {
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
      });
  };

  renderElement = (linkElement: JSX.Element) => {
    const { link } = this.props;

    if (link.tooltip) {
      return (
        <div className="gf-form">
          <Tooltip content={link.tooltip}>{linkElement}</Tooltip>;
        </div>
      );
    } else {
      return <div className="gf-form">{linkElement}</div>;
    }
  };

  renderList = () => {
    const { link } = this.props;
    const { searchHits } = this.state;

    return (
      <>
        {searchHits.length > 0 &&
          searchHits.map((dashboard: any, index: number) => {
            const linkElement = (
              <a
                key={`${dashboard.id}-${index}`}
                className="gf-form-label"
                href={sanitizeUrl(dashboard.url)}
                target={link.targetBlank ? '_blank' : '_self'}
              >
                <Icon name="apps" style={{ marginRight: '4px' }} />
                <span>{sanitize(dashboard.title)}</span>
              </a>
            );
            return this.renderElement(linkElement);
          })}
      </>
    );
  };

  renderDropdown = () => {
    const { link, linkInfo } = this.props;
    const { searchHits } = this.state;

    const linkElement = (
      <>
        <a
          className="gf-form-label pointer"
          onClick={this.onDropDownClick}
          data-placement="bottom"
          data-toggle="dropdown"
        >
          <Icon name="bars" />
          <span>{linkInfo.title}</span>
        </a>
        <ul className="dropdown-menu pull-right" role="menu">
          {searchHits.length > 0 &&
            searchHits.map((dashboard: any, index: number) => {
              return (
                <li key={`${dashboard.id}-${index}`}>
                  <a href={sanitizeUrl(dashboard.url)} target={link.targetBlank ? '_blank' : '_self'}>
                    {sanitize(dashboard.title)}
                  </a>
                </li>
              );
            })}
        </ul>
      </>
    );

    return this.renderElement(linkElement);
  };

  render() {
    if (this.props.link.asDropdown) {
      return this.renderDropdown();
    } else {
      return this.renderList();
    }
  }
}
