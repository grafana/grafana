import { css } from '@emotion/css';
import { createRef, PureComponent, type JSX } from 'react';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import {
  AnnotationChangeEvent,
  type AnnotationEvent,
  AppEvents,
  dateTime,
  dateMath,
  type GrafanaTheme2,
  locationUtil,
  type PanelProps,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getBackendSrv, locationService, ScopesContext, type ScopesContextValue } from '@grafana/runtime';
import { Button, ScrollContainer, stylesFactory, TagList } from '@grafana/ui';
import { AbstractList } from '@grafana/ui/internal';
import { type AnnotationEventResource, annotationK8sClient } from 'app/api/clients/annotation/v0alpha1';
import { getAPINamespace } from 'app/api/utils';
import { appEvents } from 'app/core/app_events';
import { isK8sAnnotationsClientEnabled } from 'app/features/annotations/api';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

interface DisplayItem {
  identity: { type: string; name: string };
  displayName: string;
  avatarURL?: string;
  internalId?: number;
}

import { AnnotationListItem } from './AnnotationListItem';
import { type Options } from './panelcfg.gen';

interface UserInfo {
  id?: number;
  login?: string;
  email?: string;
  // The k8s identity ref ("user:<uid>") used to filter through the new /search endpoint.
  // Absent when the legacy path (k8s annotations client disabled) populated this entry.
  uid?: string;
}

export interface Props extends PanelProps<Options> {}
interface State {
  annotations: AnnotationEvent[];
  timeInfo: string;
  loaded: boolean;
  queryUser?: UserInfo;
  queryTags: string[];
  requestId: string;
}
export class AnnoListPanel extends PureComponent<Props, State> {
  // ScopesContext lets the /search call below filter annotations by the dashboard's
  // currently selected scopes — same source the create/update path reads from.
  static contextType = ScopesContext;
  declare context: ScopesContextValue | undefined;

  style = getStyles(config.theme2);
  subs = new Subscription();
  tagListRef = createRef<HTMLUListElement>();

  constructor(props: Props) {
    super(props);

    this.state = {
      annotations: [],
      timeInfo: '',
      loaded: false,
      queryTags: [],
      requestId: `anno-list-panel-${Math.random()}`,
    };
  }

  componentDidMount() {
    // When an annotation on this dashboard changes, re-run the query
    this.subs.add(
      this.props.eventBus.getStream(AnnotationChangeEvent).subscribe({
        next: () => {
          this.doSearch();
        },
      })
    );

    // ScopesContext exposes a stable Provider value; consumers subscribe to
    // stateObservable to react to scope changes. The BehaviorSubject replay
    // drives the initial doSearch; distinctUntilChanged dedupes by joined
    // scope-name key so only real changes trigger a re-query.
    if (this.context) {
      this.subs.add(
        this.context.stateObservable
          .pipe(
            map((state) => state.value.map((s) => s.metadata.name).join(',')),
            distinctUntilChanged()
          )
          .subscribe(() => this.doSearch())
      );
    } else {
      this.doSearch();
    }
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
    const { queryUser, queryTags, requestId } = this.state;

    const dashboardUID = options.onlyFromThisDashboard ? getDashboardSrv().getCurrent()?.uid : undefined;

    let timeInfo = '';
    let from: number | undefined;
    let to: number | undefined;
    if (options.onlyInTimeRange) {
      const { timeRange } = this.props;
      from = timeRange.from.valueOf();
      to = timeRange.to.valueOf();
    } else {
      timeInfo = 'All Time';
    }

    const interpolatedTags = options.tags?.length
      ? options.tags.map((tag) => this.props.replaceVariables(tag))
      : undefined;
    const tags = queryTags.length
      ? interpolatedTags
        ? [...interpolatedTags, ...queryTags]
        : queryTags
      : interpolatedTags;

    const scopeNames = this.context?.state.value?.map((s) => s.metadata.name);

    let annotations: AnnotationEvent[];
    if (isK8sAnnotationsClientEnabled()) {
      // /search hardcodes Type: "annotation" on the backend, so the legacy `type: 'annotation'`
      // filter is implicit. User filter switches from legacy `userId` to k8s `createdBy`.
      const events = await annotationK8sClient.search(
        {
          dashboardUID,
          from,
          to,
          limit: options.limit,
          tags,
          createdBy: queryUser?.uid ? `user:${queryUser.uid}` : undefined,
          scopes: scopeNames && scopeNames.length > 0 ? scopeNames : undefined,
        },
        requestId
      );
      annotations = await this.hydrateIdentities(events);
    } else {
      const params: Record<string, unknown> = {
        tags,
        limit: options.limit,
        type: 'annotation',
        dashboardUID,
        from,
        to,
        userId: queryUser?.id,
      };
      annotations = await getBackendSrv().get('/api/annotations', params, requestId);
    }

    this.setState({
      annotations,
      timeInfo,
      loaded: true,
    });
  }

  // Hydrate identity-derived fields on each event by batching one IAM /display
  // lookup for all unique createdBy keys. /display omits email, so displayName
  // stands in for the existing "Created by" tooltip text.
  private hydrateIdentities = async (events: AnnotationEventResource[]): Promise<AnnotationEvent[]> => {
    const keys = Array.from(new Set(events.map((e) => e.createdBy).filter((k): k is string => Boolean(k))));
    if (keys.length === 0) {
      return events;
    }

    const url = `/apis/iam.grafana.app/v0alpha1/namespaces/${getAPINamespace()}/display`;
    const response = await getBackendSrv().get<{ display?: DisplayItem[] }>(url, { key: keys });
    const byKey = new Map<string, DisplayItem>();
    for (const d of response.display ?? []) {
      byKey.set(`${d.identity.type}:${d.identity.name}`, d);
    }

    return events.map((event) => {
      const display = event.createdBy ? byKey.get(event.createdBy) : undefined;
      if (!display) {
        return event;
      }
      return {
        ...event,
        userId: display.internalId,
        login: display.displayName,
        email: display.displayName,
        avatarUrl: display.avatarURL,
      };
    });
  };

  onAnnoClick = async (anno: AnnotationEvent) => {
    if (!anno.time) {
      return;
    }

    const { options } = this.props;
    const dashboardSrv = getDashboardSrv();
    const current = dashboardSrv.getCurrent();

    const params = {
      from: this._timeOffset(anno.time, options.navigateBefore, true),
      to: this._timeOffset(anno.timeEnd ?? anno.time, options.navigateAfter, false),
      viewPanel: options.navigateToPanel && anno.panelId ? anno.panelId : undefined,
    };

    if (!anno.dashboardUID || current?.uid === anno.dashboardUID) {
      locationService.partial(params);
      return;
    }

    const result = await getBackendSrv().get('/api/search', { dashboardUIDs: anno.dashboardUID });
    if (result && result.length && result[0].uid === anno.dashboardUID) {
      const dash = result[0];
      const url = new URL(dash.url, window.location.origin);
      url.searchParams.set('from', String(params.from));
      url.searchParams.set('to', String(params.to));
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

    if (!dateMath.isDurationUnit(unit)) {
      return 0;
    }

    return t.add(incr, unit).valueOf();
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
    // Hydrated events expose the k8s identity ref ("user:<uid>") via createdBy when
    // the k8s annotations client is enabled. Stash the uid so the next /search can filter by it.
    const createdBy = 'createdBy' in anno && typeof anno.createdBy === 'string' ? anno.createdBy : undefined;
    const uid = createdBy?.startsWith('user:') ? createdBy.slice('user:'.length) : undefined;
    this.setState({
      queryUser: {
        id: anno.userId,
        login: anno.login,
        email: anno.email,
        uid,
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
      return (
        <div>
          <Trans i18nKey="annolist.anno-list-panel.loading">Loading...</Trans>
        </div>
      );
    }

    // Previously we showed inidication that it covered all time
    // { timeInfo && (
    //   <span className="panel-time-info">
    //     <Icon name="clock-nine" /> {timeInfo}
    //   </span>
    // )}

    const hasFilter = queryUser || queryTags.length > 0;
    return (
      <ScrollContainer minHeight="100%">
        {hasFilter && (
          <div className={this.style.filter}>
            <b>
              <Trans i18nKey="annolist.anno-list-panel.filter">Filter:</Trans>
            </b>
            {queryUser && (
              <Button
                size="sm"
                variant="secondary"
                fill="text"
                onClick={this.onClearUser}
                aria-label={t(
                  'annolist.anno-list-panel.aria-label-remove-filter',
                  'Remove filter: {{filterToRemove}}',
                  { filterToRemove: queryUser.email }
                )}
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

        {annotations.length < 1 && (
          <div className={this.style.noneFound}>
            <Trans i18nKey="annolist.anno-list-panel.no-annotations-found">No annotations found</Trans>
          </div>
        )}

        <AbstractList items={annotations} renderItem={this.renderItem} getItemKey={(item) => `${item.id}`} />
      </ScrollContainer>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  noneFound: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 'calc(100% - 30px)',
  }),
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
