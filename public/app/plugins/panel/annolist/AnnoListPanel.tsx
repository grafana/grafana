import { css } from '@emotion/css';
import { createRef, PureComponent, type JSX } from 'react';
import { Subscription } from 'rxjs';

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
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { Button, ScrollContainer, stylesFactory, TagList } from '@grafana/ui';
import { AbstractList } from '@grafana/ui/internal';
import { type AnnotationEventResource, annotationK8sClient } from 'app/api/clients/annotation/v0alpha1';
import { getAPINamespace } from 'app/api/utils';
import { appEvents } from 'app/core/app_events';
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
  // Absent when the legacy path (kubernetesAnnotations FF off) populated this entry.
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

    let annotations: AnnotationEvent[];
    if (config.featureToggles.kubernetesAnnotations) {
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

  // Hydrate identity-derived fields on each event. /display is a batch lookup
  // (one call for all keys) but doesn't expose email, so we fetch each unique
  // User resource in parallel to read spec.email. A per-user fetch may 403 for
  // viewers without iam:users:get; on failure we fall back to displayName so
  // the tooltip still has a label.
  private hydrateIdentities = async (events: AnnotationEventResource[]): Promise<AnnotationEvent[]> => {
    const keys = Array.from(new Set(events.map((e) => e.createdBy).filter((k): k is string => Boolean(k))));
    if (keys.length === 0) {
      return events;
    }

    const ns = getAPINamespace();
    const userUids = keys.filter((k) => k.startsWith('user:')).map((k) => k.slice('user:'.length));

    const [displayResp, emailByUid] = await Promise.all([
      getBackendSrv().get<{ display?: DisplayItem[] }>(`/apis/iam.grafana.app/v0alpha1/namespaces/${ns}/display`, {
        key: keys,
      }),
      Promise.all(
        userUids.map(async (uid): Promise<[string, string | undefined]> => {
          try {
            const u = await getBackendSrv().get<{ spec?: { email?: string } }>(
              `/apis/iam.grafana.app/v0alpha1/namespaces/${ns}/users/${uid}`
            );
            return [uid, u.spec?.email];
          } catch {
            return [uid, undefined];
          }
        })
      ).then((entries) => new Map(entries)),
    ]);

    const byKey = new Map<string, DisplayItem>();
    for (const d of displayResp.display ?? []) {
      byKey.set(`${d.identity.type}:${d.identity.name}`, d);
    }

    return events.map((event) => {
      const display = event.createdBy ? byKey.get(event.createdBy) : undefined;
      if (!display) {
        return event;
      }
      const uid = event.createdBy?.startsWith('user:') ? event.createdBy.slice('user:'.length) : undefined;
      const email = uid ? emailByUid.get(uid) : undefined;
      return {
        ...event,
        userId: display.internalId,
        login: display.displayName,
        email: email ?? display.displayName,
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
    // kubernetesAnnotations is on. Stash the uid so the next /search can filter by it.
    const createdBy = (anno as AnnotationEventResource).createdBy;
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
