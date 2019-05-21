// Libraries
import React, { PureComponent } from 'react';

// /* tslint:disable:import-blacklist ban ban-types */
// import moment from 'moment';

// Types
import { AnnoOptions } from './types';
import { PanelProps, Annotation, Tooltip } from '@grafana/ui';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { AbstractList } from '@grafana/ui/src/components/List/AbstractList';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';

interface Props extends PanelProps<AnnoOptions> {}
interface State {
  annotations: Annotation[];
  timeInfo: string;
  loaded: boolean;
}

export class AnnoListPanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      annotations: [],
      timeInfo: '',
      loaded: false,
    };
  }

  componentDidMount() {
    this.doSearch();
  }

  componentDidUpdate(prevProps: Props) {
    const { options, timeRange } = this.props;
    if (options !== prevProps.options || timeRange !== prevProps.timeRange) {
      this.doSearch();
    }
  }

  async doSearch() {
    // http://docs.grafana.org/http_api/annotations/
    // https://github.com/grafana/grafana/blob/master/public/app/core/services/backend_srv.ts
    // https://github.com/grafana/grafana/blob/master/public/app/features/annotations/annotations_srv.ts

    const { options } = this.props;

    const params: any = {
      tags: options.tags,
      limit: options.limit,
      type: 'annotation', // Skip the Annotations that are really alerts.  (Use the alerts panel!)
    };

    if (options.onlyFromThisDashboard) {
      //params.dashboardId = this.dashboard.id;
    }

    let timeInfo = '';
    if (options.onlyInTimeRange) {
      const { timeRange } = this.props;
      params.from = timeRange.from.valueOf();
      params.to = timeRange.to.valueOf();
    } else {
      timeInfo = 'All Time';
    }

    // if (this.queryUserId !== undefined) {
    //   params.userId = this.queryUserId;
    //   timeInfo += ' ' + this.queryUser;
    // }

    if (options.tags && options.tags.length) {
      params.tags = options.tags;
      //timeInfo += ' ' + this.queryTagValue;
    }

    const annotations = await getBackendSrv().get('/api/annotations', params);
    this.setState({
      annotations,
      timeInfo,
      loaded: true,
    });
  }

  // <div className="" ng-repeat="plugin in category.list">
  //       <a className="pluginlist-link pluginlist-link-{{plugin.state}} pointer" href="{{plugin.defaultNavUrl}}">
  //         <span>
  //           <img ng-src="{{plugin.info.logos.small}}" className="pluginlist-image">
  //           <span className="pluginlist-title">{{plugin.name}}</span>
  //           <span className="pluginlist-version">v{{plugin.info.version}}</span>
  //         </span>
  //         <span className="pluginlist-message pluginlist-message--update"
  //ng-show="plugin.hasUpdate"
  //ng-click="ctrl.updateAvailable(plugin, $event)"
  //bs-tooltip="'New version: ' + plugin.latestVersion">
  //           Update available!
  //         </span>
  //         <span className="pluginlist-message pluginlist-message--enable" ng-show="!plugin.enabled && !plugin.hasUpdate">
  //           Enable now
  //         </span>
  //         <span className="pluginlist-message pluginlist-message--no-update" ng-show="plugin.enabled && !plugin.hasUpdate">
  //           Up to date
  //         </span>
  //       </a>
  //     </div>

  onAnnoClick = (e: React.SyntheticEvent, anno: Annotation) => {
    e.stopPropagation();
    console.log('Clicked:', anno);
  };

  onTagClick = (e: React.SyntheticEvent, tag: string) => {
    e.stopPropagation();
    console.log('Clicked Tag:', tag);
  };

  onUserClick = (e: React.SyntheticEvent, anno: Annotation) => {
    e.stopPropagation();
    console.log('Clicked User:', anno.login);
  };

  renderTags = (tags: string[]): JSX.Element => {
    if (!tags || !tags.length) {
      return null;
    }
    return (
      <>
        {tags.map(tag => {
          return (
            <span key={tag} onClick={e => this.onTagClick(e, tag)}>
              <TagBadge label={tag} removeIcon={false} count={0} />
            </span>
          );
        })}
      </>
    );
  };

  renderItem = (anno: Annotation, index: number): JSX.Element => {
    const { options } = this.props;
    const { showUser, showTags, showTime } = options;

    const userTooltip = (
      <span>
        Created by:
        <br /> {anno.email}
      </span>
    );

    return (
      <div className="dashlist-item">
        <span
          className="dashlist-link pointer"
          onClick={e => {
            this.onAnnoClick(e, anno);
          }}
        >
          <span className="dashlist-title">{anno.text}</span>

          <span className="pluginlist-message">
            {anno.login && showUser && (
              <span className="graph-annotation">
                <Tooltip content={userTooltip} theme="info" placement="top">
                  <span onClick={e => this.onUserClick(e, anno)} className="graph-annotation__user">
                    <img src={anno.avatarUrl} />
                  </span>
                </Tooltip>
              </span>
            )}
            {showTags && this.renderTags(anno.tags)}
          </span>

          <span className="pluginlist-version">{showTime && <span>{anno.time}</span>}</span>
        </span>
      </div>
    );
  };

  render() {
    const { loaded, timeInfo, annotations } = this.state;
    if (!loaded) {
      return <div>loading...</div>;
    }
    if (!annotations.length) {
      return <div>No annotations found</div>;
    }

    return (
      <div>
        {timeInfo && (
          <span className="panel-time-info">
            <i className="fa fa-clock-o" /> {timeInfo}
          </span>
        )}
        <AbstractList
          items={annotations}
          renderItem={this.renderItem}
          getItemKey={item => {
            return item.id + '';
          }}
          className="dashlist"
        />
      </div>
    );
  }
}
