import {
  DataFrame,
  DataQueryRequest,
  dateTime,
  durationToMilliseconds,
  Field,
  incrRoundDn,
  isValidDuration,
  parseDuration,
} from '@grafana/data/src';
import { faro } from '@grafana/faro-web-sdk';
import { config, reportInteraction } from '@grafana/runtime/src';
import { amendTable, Table, trimTable } from 'app/features/live/data/amendTimeSeries';

import { getTimeSrv } from '../../../../features/dashboard/services/TimeSrv';
import { PromQuery } from '../types';

// dashboardUID + panelId + refId
// (must be stable across query changes, time range changes / interval changes / panel resizes / template variable changes)
type TargetIdent = string;

type RequestID = string;

// query + template variables + interval + raw time range
// used for full target cache busting -> full range re-query
type TargetSig = string;

type TimestampMs = number;

type SupportedQueryTypes = PromQuery;

// string matching requirements defined in durationutil.ts
export const defaultPrometheusQueryOverlapWindow = '10m';

interface TargetCache {
  sig: TargetSig;
  prevTo: TimestampMs;
  frames: DataFrame[];
}

export interface CacheRequestInfo<T extends SupportedQueryTypes> {
  requests: Array<DataQueryRequest<T>>;
  targSigs: Map<TargetIdent, TargetSig>;
  shouldCache: boolean;
}

export interface DatasourceProfileData {
  interval?: string;
  expr: string;
  datasource: string;
}

interface ProfileData extends DatasourceProfileData {
  identity: string;
  bytes: number | null;
  dashboardUID: string;
  panelId?: number;
  from: string;
  queryRangeSeconds: number;
  refreshIntervalMs: number;
}

/**
 * Get field identity
 * This is the string used to uniquely identify a field within a "target"
 * @param field
 */
export const getFieldIdent = (field: Field) => `${field.type}|${field.name}|${JSON.stringify(field.labels ?? '')}`;

/**
 * NOMENCLATURE
 * Target: The request target (DataQueryRequest), i.e. a specific query reference within a panel
 * Ident: Identity: the string that is not expected to change
 * Sig: Signature: the string that is expected to change, upon which we wipe the cache fields
 */
export class QueryCache<T extends SupportedQueryTypes> {
  private overlapWindowMs: number;
  private getTargetSignature: (request: DataQueryRequest<T>, target: T) => string;
  private getProfileData?: (request: DataQueryRequest<T>, target: T) => DatasourceProfileData;

  private perfObeserver?: PerformanceObserver;
  private shouldProfile: boolean;

  // send profile events every 10 minutes
  sendEventsInterval = 60000 * 10;

  pendingRequestIdsToTargSigs = new Map<RequestID, ProfileData>();

  pendingAccumulatedEvents = new Map<
    string,
    {
      requestCount: number;
      savedBytesTotal: number;
      initialRequestSize: number;
      lastRequestSize: number;
      panelId: string;
      dashId: string;
      expr: string;
      refreshIntervalMs: number;
      sent: boolean;
      datasource: string;
      from: string;
      queryRangeSeconds: number;
    }
  >();

  cache = new Map<TargetIdent, TargetCache>();

  constructor(options: {
    getTargetSignature: (request: DataQueryRequest<T>, target: T) => string;
    overlapString: string;
    profileFunction?: (request: DataQueryRequest<T>, target: T) => DatasourceProfileData;
  }) {
    const unverifiedOverlap = options.overlapString;
    if (isValidDuration(unverifiedOverlap)) {
      const duration = parseDuration(unverifiedOverlap);
      this.overlapWindowMs = durationToMilliseconds(duration);
    } else {
      const duration = parseDuration(defaultPrometheusQueryOverlapWindow);
      this.overlapWindowMs = durationToMilliseconds(duration);
    }

    if (
      (config.grafanaJavascriptAgent.enabled || config.featureToggles?.prometheusIncrementalQueryInstrumentation) &&
      options.profileFunction !== undefined
    ) {
      this.profile();
      this.shouldProfile = true;
    } else {
      this.shouldProfile = false;
    }
    this.getProfileData = options.profileFunction;
    this.getTargetSignature = options.getTargetSignature;
  }

  private profile() {
    // Check if PerformanceObserver is supported, and if we have Faro enabled for internal profiling
    if (typeof PerformanceObserver === 'function') {
      this.perfObeserver = new PerformanceObserver((list: PerformanceObserverEntryList) => {
        list.getEntries().forEach((entry) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const entryTypeCast: PerformanceResourceTiming = entry as PerformanceResourceTiming;

          // Safari support for this is coming in 16.4:
          // https://caniuse.com/mdn-api_performanceresourcetiming_transfersize
          // Gating that this exists to prevent runtime errors
          const isSupported = typeof entryTypeCast?.transferSize === 'number';

          if (entryTypeCast?.initiatorType === 'fetch' && isSupported) {
            let fetchUrl = entryTypeCast.name;

            if (fetchUrl.includes('/api/ds/query')) {
              let match = fetchUrl.match(/requestId=([a-z\d]+)/i);

              if (match) {
                let requestId = match[1];

                const requestTransferSize = Math.round(entryTypeCast.transferSize);
                const currentRequest = this.pendingRequestIdsToTargSigs.get(requestId);

                if (currentRequest) {
                  const entries = this.pendingRequestIdsToTargSigs.entries();

                  for (let [, value] of entries) {
                    if (value.identity === currentRequest.identity && value.bytes !== null) {
                      const previous = this.pendingAccumulatedEvents.get(value.identity);

                      const savedBytes = value.bytes - requestTransferSize;

                      this.pendingAccumulatedEvents.set(value.identity, {
                        datasource: value.datasource ?? 'N/A',
                        requestCount: (previous?.requestCount ?? 0) + 1,
                        savedBytesTotal: (previous?.savedBytesTotal ?? 0) + savedBytes,
                        initialRequestSize: value.bytes,
                        lastRequestSize: requestTransferSize,
                        panelId: currentRequest.panelId?.toString() ?? '',
                        dashId: currentRequest.dashboardUID ?? '',
                        expr: currentRequest.expr ?? '',
                        refreshIntervalMs: currentRequest.refreshIntervalMs ?? 0,
                        sent: false,
                        from: currentRequest.from ?? '',
                        queryRangeSeconds: currentRequest.queryRangeSeconds ?? 0,
                      });

                      // We don't need to save each subsequent request, only the first one
                      this.pendingRequestIdsToTargSigs.delete(requestId);

                      return;
                    }
                  }

                  // If we didn't return above, this should be the first request, let's save the observed size
                  this.pendingRequestIdsToTargSigs.set(requestId, { ...currentRequest, bytes: requestTransferSize });
                }
              }
            }
          }
        });
      });

      this.perfObeserver.observe({ type: 'resource', buffered: false });

      setInterval(this.sendPendingTrackingEvents, this.sendEventsInterval);

      // Send any pending profile information when the user navigates away
      window.addEventListener('beforeunload', this.sendPendingTrackingEvents);
    }
  }

  sendPendingTrackingEvents = () => {
    const entries = this.pendingAccumulatedEvents.entries();

    for (let [key, value] of entries) {
      if (!value.sent) {
        const event = {
          datasource: value.datasource.toString(),
          requestCount: value.requestCount.toString(),
          savedBytesTotal: value.savedBytesTotal.toString(),
          initialRequestSize: value.initialRequestSize.toString(),
          lastRequestSize: value.lastRequestSize.toString(),
          panelId: value.panelId.toString(),
          dashId: value.dashId.toString(),
          expr: value.expr.toString(),
          refreshIntervalMs: value.refreshIntervalMs.toString(),
          from: value.from.toString(),
          queryRangeSeconds: value.queryRangeSeconds.toString(),
        };

        if (config.featureToggles.prometheusIncrementalQueryInstrumentation) {
          reportInteraction('grafana_incremental_queries_profile', event);
        } else if (faro.api.pushEvent) {
          faro.api.pushEvent('incremental query response size', event, 'no-interaction', {
            skipDedupe: true,
          });
        }

        this.pendingAccumulatedEvents.set(key, {
          ...value,
          sent: true,
          requestCount: 0,
          savedBytesTotal: 0,
          initialRequestSize: 0,
          lastRequestSize: 0,
        });
      }
    }
  };

  // can be used to change full range request to partial, split into multiple requests
  requestInfo(request: DataQueryRequest<T>): CacheRequestInfo<T> {
    // TODO: align from/to to interval to increase probability of hitting backend cache

    const newFrom = request.range.from.valueOf();
    const newTo = request.range.to.valueOf();

    // only cache 'now'-relative queries (that can benefit from a backfill cache)
    const shouldCache = request.rangeRaw?.to?.toString() === 'now';

    // all targets are queried together, so we check for any that causes group cache invalidation & full re-query
    let doPartialQuery = shouldCache;
    let prevTo: TimestampMs | undefined = undefined;

    const refreshIntervalMs = getTimeSrv().refreshMS;

    // pre-compute reqTargSigs
    const reqTargSigs = new Map<TargetIdent, TargetSig>();
    request.targets.forEach((targ) => {
      let targIdent = `${request.dashboardUID}|${request.panelId}|${targ.refId}`;
      let targSig = this.getTargetSignature(request, targ); // ${request.maxDataPoints} ?

      if (this.shouldProfile && this.getProfileData) {
        this.pendingRequestIdsToTargSigs.set(request.requestId, {
          ...this.getProfileData(request, targ),
          identity: targIdent + '|' + targSig,
          bytes: null,
          panelId: request.panelId,
          dashboardUID: request.dashboardUID ?? '',
          from: request.rangeRaw?.from.toString() ?? '',
          queryRangeSeconds: request.range.to.diff(request.range.from, 'seconds') ?? '',
          refreshIntervalMs: refreshIntervalMs ?? 0,
        });
      }

      reqTargSigs.set(targIdent, targSig);
    });

    // figure out if new query range or new target props trigger full cache invalidation & re-query
    for (const [targIdent, targSig] of reqTargSigs) {
      let cached = this.cache.get(targIdent);
      let cachedSig = cached?.sig;

      if (cachedSig !== targSig) {
        doPartialQuery = false;
      } else {
        // only do partial queries when new request range follows prior request range (possibly with overlap)
        // e.g. now-6h with refresh <= 6h
        prevTo = cached?.prevTo ?? Infinity;

        doPartialQuery = newTo > prevTo && newFrom <= prevTo;
      }

      if (!doPartialQuery) {
        break;
      }
    }

    if (doPartialQuery && prevTo) {
      // clamp to make sure we don't re-query previous 10m when newFrom is ahead of it (e.g. 5min range, 30s refresh)
      let newFromPartial = Math.max(prevTo - this.overlapWindowMs, newFrom);

      const newToDate = dateTime(newTo);
      const newFromPartialDate = dateTime(incrRoundDn(newFromPartial, request.intervalMs));

      // modify to partial query
      request = {
        ...request,
        range: {
          ...request.range,
          from: newFromPartialDate,
          to: newToDate,
        },
      };
    } else {
      reqTargSigs.forEach((targSig, targIdent) => {
        this.cache.delete(targIdent);
      });
    }

    return {
      requests: [request],
      targSigs: reqTargSigs,
      shouldCache,
    };
  }

  // should amend existing cache with new frames and return full response
  procFrames(
    request: DataQueryRequest<T>,
    requestInfo: CacheRequestInfo<T> | undefined,
    respFrames: DataFrame[]
  ): DataFrame[] {
    if (requestInfo?.shouldCache) {
      const newFrom = request.range.from.valueOf();
      const newTo = request.range.to.valueOf();

      // group frames by targets
      const respByTarget = new Map<TargetIdent, DataFrame[]>();

      respFrames.forEach((frame: DataFrame) => {
        let targIdent = `${request.dashboardUID}|${request.panelId}|${frame.refId}`;

        let frames = respByTarget.get(targIdent);

        if (!frames) {
          frames = [];
          respByTarget.set(targIdent, frames);
        }

        frames.push(frame);
      });

      let outFrames: DataFrame[] = [];

      respByTarget.forEach((respFrames, targIdent) => {
        let cachedFrames = (targIdent ? this.cache.get(targIdent)?.frames : null) ?? [];

        respFrames.forEach((respFrame: DataFrame) => {
          // skip empty frames
          if (respFrame.length === 0 || respFrame.fields.length === 0) {
            return;
          }

          // frames are identified by their second (non-time) field's name + labels
          // TODO: maybe also frame.meta.type?
          let respFrameIdent = getFieldIdent(respFrame.fields[1]);

          let cachedFrame = cachedFrames.find((cached) => getFieldIdent(cached.fields[1]) === respFrameIdent);

          if (!cachedFrame) {
            // append new unknown frames
            cachedFrames.push(respFrame);
          } else {
            // we assume that fields cannot appear/disappear and will all exist in same order

            // amend & re-cache
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            let prevTable: Table = cachedFrame.fields.map((field) => field.values) as Table;
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            let nextTable: Table = respFrame.fields.map((field) => field.values) as Table;

            let amendedTable = amendTable(prevTable, nextTable);
            if (amendedTable) {
              for (let i = 0; i < amendedTable.length; i++) {
                cachedFrame.fields[i].values = amendedTable[i];
              }
              cachedFrame.length = cachedFrame.fields[0].values.length;
            }
          }
        });

        // trim all frames to in-view range, evict those that end up with 0 length
        let nonEmptyCachedFrames: DataFrame[] = [];

        cachedFrames.forEach((frame) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          let table: Table = frame.fields.map((field) => field.values) as Table;

          let trimmed = trimTable(table, newFrom, newTo);

          if (trimmed[0].length > 0) {
            for (let i = 0; i < trimmed.length; i++) {
              frame.fields[i].values = trimmed[i];
            }
            nonEmptyCachedFrames.push(frame);
          }
        });

        this.cache.set(targIdent, {
          sig: requestInfo.targSigs.get(targIdent)!,
          frames: nonEmptyCachedFrames,
          prevTo: newTo,
        });

        outFrames.push(...nonEmptyCachedFrames);
      });

      // transformV2 mutates field values for heatmap de-accum, and modifies field order, so we gotta clone here, for now :(
      respFrames = outFrames.map((frame) => ({
        ...frame,
        fields: frame.fields.map((field) => ({
          ...field,
          config: {
            ...field.config, // prevents mutatative exemplars links (re)enrichment
          },
          values: field.values.slice(),
        })),
      }));
    }

    return respFrames;
  }
}
