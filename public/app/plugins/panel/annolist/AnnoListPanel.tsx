import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { Subscription } from 'rxjs';

import {
  AnnotationChangeEvent,
  AnnotationEvent,
  AppEvents,
  dateTime,
  DurationUnit,
  GrafanaTheme2,
  locationUtil,
  PanelProps,
} from '@grafana/data';
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { Button, CustomScrollbar, stylesFactory, TagList } from '@grafana/ui';
import { AbstractList } from '@grafana/ui/src/components/List/AbstractList';
import appEvents from 'app/core/app_events';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { AnnotationListItem } from './AnnotationListItem';
import { PanelOptions } from './panelcfg.gen';

interface UserInfo {
  id?: number;
  login?: string;
  email?: string;
}

export interface Props extends PanelProps<PanelOptions> {}
interface State {
  annotations: AnnotationEvent[];
  timeInfo: string;
  loaded: boolean;
  queryUser?: UserInfo;
  queryTags: string[];
}
export class AnnoListPanel extends PureComponent<Props, State> {
  style = getStyles(config.theme2);
  subs = new Subscription();
  tagListRef = React.createRef<HTMLUListElement>();

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
      prevProps.renderCounter !== this.props.renderCounter ||
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
      params.dashboardUID = getDashboardSrv().getCurrent()?.uid;
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
      params.tags = options.tags.map((tag) => this.props.replaceVariables(tag));
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

  onAnnoClick = async (anno: AnnotationEvent) => {
    if (!anno.time) {
      return;
    }

    const { options } = this.props;
    const dashboardSrv = getDashboardSrv();
    const current = dashboardSrv.getCurrent();

    const params: any = {
      from: this._timeOffset(anno.time, options.navigateBefore, true),
      to: this._timeOffset(anno.timeEnd ?? anno.time, options.navigateAfter, false),
    };

    if (options.navigateToPanel) {
      params.viewPanel = anno.panelId;
    }

    if (current?.uid === anno.dashboardUID) {
      locationService.partial(params);
      return;
    }

    const result = await getBackendSrv().get('/api/search', { dashboardUIDs: anno.dashboardUID });
    if (result && result.length && result[0].uid === anno.dashboardUID) {
      const dash = result[0];
      const url = new URL(dash.url, window.location.origin);
      url.searchParams.set('from', params.from);
      url.searchParams.set('to', params.to);
      locationService.push(locationUtil.stripBaseFromUrl(url.toString()));
      return;
    }
    appEvents.emit(AppEvents.alertWarning, ['Unknown Dashboard: ' + anno.dashboardUID]);
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
    if (!remove && this.state.queryTags.includes(tag)) {
      return;
    }

    const queryTags = remove ? this.state.queryTags.filter((item) => item !== tag) : [...this.state.queryTags, tag];

    // Logic to ensure keyboard focus isn't lost when the currently
    // focused tag is removed
    let nextTag: HTMLElement | undefined = undefined;
    if (remove) {
      const focusedTag = document.activeElement;
      const dataTagId = focusedTag?.getAttribute('data-tag-id');
      if (this.tagListRef.current?.contains(focusedTag) && dataTagId) {
        const parsedTagId = Number.parseInt(dataTagId, 10);
        const possibleNextTag =
          this.tagListRef.current.querySelector(`[data-tag-id="${parsedTagId + 1}"]`) ??
          this.tagListRef.current.querySelector(`[data-tag-id="${parsedTagId - 1}"]`);
        if (possibleNextTag instanceof HTMLElement) {
          nextTag = possibleNextTag;
        }
      }
    }

    this.setState({ queryTags }, () => nextTag?.focus());
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
          <div className={this.style.filter}>
            <b>Filter:</b>
            {queryUser && (
              <Button
                size="sm"
                variant="secondary"
                fill="text"
                onClick={this.onClearUser}
                aria-label={`Remove filter: ${queryUser.email}`}
              >
                {queryUser.email}
              </Button>
            )}
            {queryTags.length > 0 && (
              <TagList
                icon="times"
                tags={queryTags}
                onClick={(tag) => this.onTagClick(tag, true)}
                getAriaLabel={(name) => `Remove ${name} tag`}
                className={this.style.tagList}
                ref={this.tagListRef}
              />
            )}
          </div>
        )}

        {annotations.length < 1 && <div className={this.style.noneFound}>No Annotations Found</div>}

        <AbstractList items={annotations} renderItem={this.renderItem} getItemKey={(item) => `${item.id}`} />
      </CustomScrollbar>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  noneFound: css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: calc(100% - 30px);
  `,
  filter: css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5),
  }),
  tagList: css({
    justifyContent: 'flex-start',
    'li > button': {
      paddingLeft: '3px',
    },
  }),
}));
