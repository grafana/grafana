// Libraries
import React, { PureComponent } from 'react';
// Types
import { AnnoOptions } from './types';
import { AnnotationEvent, AppEvents, dateTime, DurationUnit, PanelProps } from '@grafana/data';
import { Tooltip } from '@grafana/ui';
import { getBackendSrv, getLocationSrv } from '@grafana/runtime';
import { AbstractList } from '@grafana/ui/src/components/List/AbstractList';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import appEvents from 'app/core/app_events';
import { css, cx } from 'emotion';

interface UserInfo {
  id?: number;
  login?: string;
  email?: string;
}

interface Props extends PanelProps<AnnoOptions> {}
interface State {
  annotations: AnnotationEvent[];
  timeInfo: string;
  loaded: boolean;
  queryUser?: UserInfo;
  queryTags: string[];
}

export class AnnoListPanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      annotations: [],
      timeInfo: '',
      loaded: false,
      queryTags: [],
    };
  }

  componentDidMount() {
    this.doSearch();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { options, timeRange } = this.props;
    const needsQuery =
      options !== prevProps.options ||
      this.state.queryTags !== prevState.queryTags ||
      this.state.queryUser !== prevState.queryUser ||
      timeRange !== prevProps.timeRange;

    if (needsQuery) {
      this.doSearch();
    }
  }

  async doSearch() {
    // http://docs.grafana.org/http_api/annotations/
    // https://github.com/grafana/grafana/blob/master/public/app/core/services/backend_srv.ts
    // https://github.com/grafana/grafana/blob/master/public/app/features/annotations/annotations_srv.ts

    const { options } = this.props;
    const { queryUser, queryTags } = this.state;

    const params: any = {
      tags: options.tags,
      limit: options.limit,
      type: 'annotation', // Skip the Annotations that are really alerts.  (Use the alerts panel!)
    };

    if (options.onlyFromThisDashboard) {
      params.dashboardId = getDashboardSrv().getCurrent().id;
    }

    let timeInfo = '';
    if (options.onlyInTimeRange) {
      const { timeRange } = this.props;
      params.from = timeRange.from.valueOf();
      params.to = timeRange.to.valueOf();
    } else {
      timeInfo = 'All Time';
    }

    if (queryUser) {
      params.userId = queryUser.id;
    }

    if (options.tags && options.tags.length) {
      params.tags = options.tags;
    }

    if (queryTags.length) {
      params.tags = params.tags ? [...params.tags, ...queryTags] : queryTags;
    }

    const annotations = await getBackendSrv().get('/api/annotations', params, `anno-list-panel-${this.props.id}`);

    this.setState({
      annotations,
      timeInfo,
      loaded: true,
    });
  }

  onAnnoClick = (e: React.SyntheticEvent, anno: AnnotationEvent) => {
    e.stopPropagation();
    if (!anno.time) {
      return;
    }

    const { options } = this.props;
    const dashboardSrv = getDashboardSrv();
    const current = dashboardSrv.getCurrent();

    const params: any = {
      from: this._timeOffset(anno.time, options.navigateBefore, true),
      to: this._timeOffset(anno.time, options.navigateAfter, false),
    };

    if (options.navigateToPanel) {
      params.viewPanel = anno.panelId;
    }

    if (current.id === anno.dashboardId) {
      getLocationSrv().update({
        query: params,
        partial: true,
      });
      return;
    }

    getBackendSrv()
      .get('/api/search', { dashboardIds: anno.dashboardId })
      .then((res: any[]) => {
        if (res && res.length && res[0].id === anno.dashboardId) {
          const dash = res[0];
          getLocationSrv().update({
            query: params,
            path: dash.url,
          });
          return;
        }
        appEvents.emit(AppEvents.alertWarning, ['Unknown Dashboard: ' + anno.dashboardId]);
      });
  };

  _timeOffset(time: number, offset: string, subtract = false): number {
    let incr = 5;
    let unit = 'm';
    const parts = /^(\d+)(\w)/.exec(offset);
    if (parts && parts.length === 3) {
      incr = parseInt(parts[1], 10);
      unit = parts[2];
    }

    const t = dateTime(time);
    if (subtract) {
      incr *= -1;
    }
    return t.add(incr, unit as DurationUnit).valueOf();
  }

  onTagClick = (e: React.SyntheticEvent, tag: string, remove?: boolean) => {
    e.stopPropagation();
    const queryTags = remove ? this.state.queryTags.filter(item => item !== tag) : [...this.state.queryTags, tag];

    this.setState({ queryTags });
  };

  onUserClick = (e: React.SyntheticEvent, anno: AnnotationEvent) => {
    e.stopPropagation();
    this.setState({
      queryUser: {
        id: anno.userId,
        login: anno.login,
        email: anno.email,
      },
    });
  };

  onClearUser = () => {
    this.setState({
      queryUser: undefined,
    });
  };

  renderTags = (tags?: string[], remove?: boolean): JSX.Element | null => {
    if (!tags || !tags.length) {
      return null;
    }
    return (
      <>
        {tags.map(tag => {
          return (
            <span key={tag} onClick={e => this.onTagClick(e, tag, remove)} className="pointer">
              <TagBadge label={tag} removeIcon={!!remove} count={0} />
            </span>
          );
        })}
      </>
    );
  };

  renderItem = (anno: AnnotationEvent, index: number): JSX.Element => {
    const { options } = this.props;
    const { showUser, showTags, showTime } = options;
    const dashboard = getDashboardSrv().getCurrent();

    return (
      <div className="dashlist-item">
        <span
          className="dashlist-link pointer"
          onClick={e => {
            this.onAnnoClick(e, anno);
          }}
        >
          <span
            className={cx([
              'dashlist-title',
              css`
                margin-right: 8px;
              `,
            ])}
          >
            {anno.text}
          </span>

          <span className="pluginlist-message">
            {anno.login && showUser && (
              <span className="graph-annotation">
                <Tooltip
                  content={
                    <span>
                      Created by:
                      <br /> {anno.email}
                    </span>
                  }
                  theme="info"
                  placement="top"
                >
                  <span onClick={e => this.onUserClick(e, anno)} className="graph-annotation__user">
                    <img src={anno.avatarUrl} />
                  </span>
                </Tooltip>
              </span>
            )}
            {showTags && this.renderTags(anno.tags, false)}
          </span>

          <span className="pluginlist-version">
            {showTime && anno.time && <span>{dashboard.formatDate(anno.time)}</span>}
          </span>
        </span>
      </div>
    );
  };

  render() {
    const { height } = this.props;
    const { loaded, annotations, queryUser, queryTags } = this.state;
    if (!loaded) {
      return <div>loading...</div>;
    }

    // Previously we showed inidication that it covered all time
    // { timeInfo && (
    //   <span className="panel-time-info">
    //     <i className="fa fa-clock-o" /> {timeInfo}
    //   </span>
    // )}

    const hasFilter = queryUser || queryTags.length > 0;

    return (
      <div style={{ height, overflow: 'scroll' }}>
        {hasFilter && (
          <div>
            <b>Filter: &nbsp; </b>
            {queryUser && (
              <span onClick={this.onClearUser} className="pointer">
                {queryUser.email}
              </span>
            )}
            {queryTags.length > 0 && this.renderTags(queryTags, true)}
          </div>
        )}

        {annotations.length < 1 && <div className="panel-alert-list__no-alerts">No Annotations Found</div>}

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
