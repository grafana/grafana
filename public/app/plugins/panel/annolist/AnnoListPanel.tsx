import { css } from '@emotion/css';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';

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
import { getBackendSrv, locationService, useScopes } from '@grafana/runtime';
import { Button, ScrollContainer, TagList, useStyles2 } from '@grafana/ui';
import { AbstractList } from '@grafana/ui/internal';
import { type AnnotationEventResource, annotationK8sClient } from 'app/api/clients/annotation/v0alpha1';
import { getAPINamespace } from 'app/api/utils';
import { appEvents } from 'app/core/app_events';
import { isK8sAnnotationsClientEnabled } from 'app/features/annotations/api';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

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
  // The creator's uid, used to filter by user on both the k8s /search and legacy
  // /api/annotations endpoints. Sourced from the k8s identity ref ("user:<uid>") or
  // the legacy response's userUID.
  uid?: string;
}

export interface Props extends PanelProps<Options> {}

export const AnnoListPanel = memo(function AnnoListPanel({
  options,
  timeRange,
  renderCounter,
  eventBus,
  replaceVariables,
}: Props) {
  // Scopes let the /search call below filter annotations by the dashboard's
  // currently selected scopes — same source the create/update path reads from.
  const scopes = useScopes();
  const styles = useStyles2(getStyles);
  const tagListRef = useRef<HTMLUListElement>(null);
  const [requestId] = useState(() => `anno-list-panel-${Math.random()}`);
  const [annotations, setAnnotations] = useState<AnnotationEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [queryUser, setQueryUser] = useState<UserInfo>();
  const [queryTags, setQueryTags] = useState<string[]>([]);

  // useScopes re-renders on every scopes state change (drawer, loading, ...);
  // keying on the joined names means only real selection changes re-query.
  // Scope names are k8s object names, so they can't contain commas.
  const scopesKey = scopes?.state.value.map((s) => s.metadata.name).join(',');
  const scopeNames = useMemo(() => (scopesKey ? scopesKey.split(',') : undefined), [scopesKey]);
  const queryTimeRange = options.onlyInTimeRange ? timeRange : undefined;

  const doSearch = useCallback(async () => {
    const dashboardUID = options.onlyFromThisDashboard ? getDashboardSrv().getCurrent()?.uid : undefined;
    const from = queryTimeRange?.from.valueOf();
    const to = queryTimeRange?.to.valueOf();

    const interpolatedTags = options.tags?.length ? options.tags.map((tag) => replaceVariables(tag)) : undefined;
    const tags = queryTags.length
      ? interpolatedTags
        ? [...interpolatedTags, ...queryTags]
        : queryTags
      : interpolatedTags;

    let result: AnnotationEvent[];
    if (await isK8sAnnotationsClientEnabled()) {
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
          scopes: scopeNames,
        },
        requestId
      );
      result = await hydrateIdentities(events);
    } else {
      const params: Record<string, unknown> = {
        tags,
        limit: options.limit,
        type: 'annotation',
        dashboardUID,
        from,
        to,
        userUID: queryUser?.uid,
      };
      result = await getBackendSrv().get('/api/annotations', params, requestId);
    }

    setAnnotations(result);
    setLoaded(true);
  }, [options, queryTimeRange, replaceVariables, queryTags, queryUser, scopeNames, requestId]);

  // When an annotation on this dashboard changes, re-run the query
  useEffect(() => {
    const sub = eventBus.getStream(AnnotationChangeEvent).subscribe({
      next: () => doSearch(),
    });
    return () => sub.unsubscribe();
  }, [eventBus, doSearch]);

  useEffect(() => {
    doSearch();
  }, [doSearch, renderCounter]);

  const onAnnoClick = async (anno: AnnotationEvent) => {
    if (!anno.time) {
      return;
    }

    const current = getDashboardSrv().getCurrent();

    const params = {
      from: timeOffset(anno.time, options.navigateBefore, true),
      to: timeOffset(anno.timeEnd ?? anno.time, options.navigateAfter, false),
      viewPanel: options.navigateToPanel && anno.panelId ? anno.panelId : undefined,
    };

    if (!anno.dashboardUID || current?.uid === anno.dashboardUID) {
      locationService.partial(params);
      return;
    }

    const result = await getGrafanaSearcher().search({
      uid: [anno.dashboardUID],
      kind: ['dashboard'],
      limit: 1,
    });
    const dash = result.view.toArray()[0];
    if (dash?.uid === anno.dashboardUID) {
      const url = new URL(dash.url, window.location.origin);
      url.searchParams.set('from', String(params.from));
      url.searchParams.set('to', String(params.to));
      locationService.push(locationUtil.stripBaseFromUrl(url.toString()));
      return;
    }
    appEvents.emit(AppEvents.alertWarning, ['Unknown Dashboard: ' + anno.dashboardUID]);
  };

  const onTagClick = (tag: string, remove?: boolean) => {
    if (!remove && queryTags.includes(tag)) {
      return;
    }

    // Logic to ensure keyboard focus isn't lost when the currently
    // focused tag is removed. TagList keys tags by name, so the next
    // tag's element survives the re-render and can be focused now.
    if (remove) {
      const focusedTag = document.activeElement;
      const dataTagId = focusedTag?.getAttribute('data-tag-id');
      if (tagListRef.current?.contains(focusedTag) && dataTagId) {
        const parsedTagId = Number.parseInt(dataTagId, 10);
        const possibleNextTag =
          tagListRef.current.querySelector(`[data-tag-id="${parsedTagId + 1}"]`) ??
          tagListRef.current.querySelector(`[data-tag-id="${parsedTagId - 1}"]`);
        if (possibleNextTag instanceof HTMLElement) {
          possibleNextTag.focus();
        }
      }
    }

    setQueryTags(remove ? queryTags.filter((item) => item !== tag) : [...queryTags, tag]);
  };

  const onUserClick = (anno: AnnotationEvent) => {
    // Normalize the creator's uid: the k8s client wraps it as "user:<uid>" in createdBy,
    // the legacy response exposes it directly as userUID. Either way, doSearch filters by uid.
    const createdBy = 'createdBy' in anno && typeof anno.createdBy === 'string' ? anno.createdBy : undefined;
    const uid = createdBy?.startsWith('user:') ? createdBy.slice('user:'.length) : anno.userUID;
    setQueryUser({
      id: anno.userId,
      login: anno.login,
      email: anno.email,
      uid,
    });
  };

  const renderItem = (anno: AnnotationEvent): JSX.Element => {
    const dashboard = getDashboardSrv().getCurrent();
    if (!dashboard) {
      return <></>;
    }

    return (
      <AnnotationListItem
        annotation={anno}
        formatDate={dashboard.formatDate}
        onClick={onAnnoClick}
        onAvatarClick={onUserClick}
        onTagClick={onTagClick}
        options={options}
      />
    );
  };

  if (!loaded) {
    return (
      <div>
        <Trans i18nKey="annolist.anno-list-panel.loading">Loading...</Trans>
      </div>
    );
  }

  const hasFilter = queryUser || queryTags.length > 0;
  return (
    <ScrollContainer minHeight="100%">
      {hasFilter && (
        <div className={styles.filter}>
          <b>
            <Trans i18nKey="annolist.anno-list-panel.filter">Filter:</Trans>
          </b>
          {queryUser && (
            <Button
              size="sm"
              variant="secondary"
              fill="text"
              onClick={() => setQueryUser(undefined)}
              aria-label={t('annolist.anno-list-panel.aria-label-remove-filter', 'Remove filter: {{filterToRemove}}', {
                filterToRemove: queryUser.email,
              })}
            >
              {queryUser.email}
            </Button>
          )}
          {queryTags.length > 0 && (
            <TagList
              icon="times"
              tags={queryTags}
              onClick={(tag) => onTagClick(tag, true)}
              getAriaLabel={(name) => `Remove ${name} tag`}
              className={styles.tagList}
              ref={tagListRef}
            />
          )}
        </div>
      )}

      {annotations.length < 1 && (
        <div className={styles.noneFound}>
          <Trans i18nKey="annolist.anno-list-panel.no-annotations-found">No annotations found</Trans>
        </div>
      )}

      <AbstractList items={annotations} renderItem={renderItem} getItemKey={(item) => `${item.id}`} />
    </ScrollContainer>
  );
});

// Hydrate identity-derived fields on each event by batching one IAM /display
// lookup for all unique createdBy keys. /display omits email, so displayName
// stands in for the existing "Created by" tooltip text.
async function hydrateIdentities(events: AnnotationEventResource[]): Promise<AnnotationEvent[]> {
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
}

function timeOffset(time: number, offset: string, subtract = false): number {
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

const getStyles = (theme: GrafanaTheme2) => ({
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
});
