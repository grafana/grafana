// Libraries
import React, { PureComponent } from 'react';
// Types
import { AnnoOptions } from './types';
import {
  AnnotationChangeEvent,
  AnnotationEvent,
  AppEvents,
  dateTime,
  DurationUnit,
  GrafanaTheme,
  locationUtil,
  PanelProps,
} from '@grafana/data';
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { AbstractList } from '@grafana/ui/src/components/List/AbstractList';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import appEvents from 'app/core/app_events';
import { AnnotationListItem } from './AnnotationListItem';
import { AnnotationListItemTags } from './AnnotationListItemTags';
import { CustomScrollbar, stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';
import { Subscription } from 'rxjs';

interface UserInfo {
  id?: number;
  login?: string;
  email?: string;
}

export interface Props extends PanelProps<AnnoOptions> {}
interface State {
  annotations: AnnotationEvent[];
  timeInfo: string;
  loaded: boolean;
  queryUser?: UserInfo;
  queryTags: string[];
}
export class AnnoListPanel extends PureComponent<Props, State> {
  style = getStyles(config.theme);
  subs = new Subscription();

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

    // When an annotation on this dashboard changes, re-run the query
    this.subs.add(
      this.props.eventBus.getStream(AnnotationChangeEvent).subscribe({
        next: () => {
          this.doSearch();
        },
      })
    );
  }

  componentWillUnmount() {
    this.subs.unsubscribe();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { options, timeRange } = this.props;
    const needsQuery =
      options !== prevProps.options ||
      this.state.queryTags !== prevState.queryTags ||
      this.state.queryUser !== prevState.queryUser ||
      (options.onlyInTimeRange && timeRange !== prevProps.timeRange);

    if (needsQuery) {
      this.doSearch();
    }
  }

  async doSearch() {
    // http://docs.grafana.org/http_api/annotations/
    // https://github.com/grafana/grafana/blob/main/public/app/core/services/backend_srv.ts
    // https://github.com/grafana/grafana/blob/main/public/app/features/annotations/annotations_srv.ts

    const { options } = this.props;
    const { queryUser, queryTags } = this.state;

    const params: any = {
      tags: options.tags,
      limit: options.limit,
      type: 'annotation', // Skip the Annotations that are really alerts.  (Use the alerts panel!)
    };

    if (options.onlyFromThisDashboard) {
      params.dashboardId = getDashboardSrv().getCurrent()?.id;
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

  onAnnoClick = (anno: AnnotationEvent) => {
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

    if (current?.id === anno.dashboardId) {
      locationService.partial(params);
      return;
    }

    getBackendSrv()
      .get('/api/search', { dashboardIds: anno.dashboardId })
      .then((res: any[]) => {
        if (res && res.length && res[0].id === anno.dashboardId) {
          const dash = res[0];
          const newUrl = locationUtil.stripBaseFromUrl(dash.url);
          locationService.push(newUrl);
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

  onTagClick = (tag: string, remove?: boolean) => {
    const queryTags = remove ? this.state.queryTags.filter((item) => item !== tag) : [...this.state.queryTags, tag];

    this.setState({ queryTags });
  };

  onUserClick = (anno: AnnotationEvent) => {
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
    return <AnnotationListItemTags tags={tags} remove={remove} onClick={this.onTagClick} />;
  };

  renderItem = (anno: AnnotationEvent, index: number): JSX.Element => {
    const { options } = this.props;
    const dashboard = getDashboardSrv().getCurrent();
    if (!dashboard) {
      return <></>;
    }

    return (
      <AnnotationListItem
        annotation={anno}
        formatDate={dashboard.formatDate}
        onClick={this.onAnnoClick}
        onAvatarClick={this.onUserClick}
        onTagClick={this.onTagClick}
        options={options}
      />
    );
  };

  render() {
    const { loaded, annotations, queryUser, queryTags } = this.state;
    if (!loaded) {
      return <div>loading...</div>;
    }

    // Previously we showed inidication that it covered all time
    // { timeInfo && (
    //   <span className="panel-time-info">
    //     <Icon name="clock-nine" /> {timeInfo}
    //   </span>
    // )}

    const hasFilter = queryUser || queryTags.length > 0;
    return (
      <CustomScrollbar autoHeightMin="100%">
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

        {annotations.length < 1 && <div className={this.style.noneFound}>No Annotations Found</div>}

        <AbstractList items={annotations} renderItem={this.renderItem} getItemKey={(item) => `${item.id}`} />
      </CustomScrollbar>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  noneFound: css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: calc(100% - 30px);
  `,
}));
