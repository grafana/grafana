import React, { PureComponent } from 'react';
import { Icon, Tooltip } from '@grafana/ui';
import { sanitize, sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';
import { DashboardLink } from '../../state/DashboardModel';
import { DashboardSearchHit } from 'app/features/search/types';

interface Props {
  link: DashboardLink;
  dashboardId: any;
}

interface State {
  searchHits: DashboardSearchHit[];
}

export class DashboardsList extends PureComponent<Props, State> {
  state = { searchHits: [] as DashboardSearchHit[] };
  componentDidMount() {
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
  }

  render() {
    const { link } = this.props;
    const { searchHits } = this.state;

    return (
      <div className="gf-form">
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
            if (link.tooltip) {
              return <Tooltip content={link.tooltip}>{linkElement}</Tooltip>;
            } else {
              return linkElement;
            }
          })}
      </div>
    );
  }
}
