import {
  ArrayVector,
  DataFrame,
  DataQueryRequest,
  dateTime,
  durationToMilliseconds,
  Field,
  isValidDuration,
  parseDuration,
} from '@grafana/data/src';
import { faro } from '@grafana/faro-web-sdk';
import { config } from '@grafana/runtime/src';
import { amendTable, Table, trimTable } from 'app/features/live/data/amendTimeSeries';

import { PromQuery } from '../types';

// dashboardUID + panelId + refId
// (must be stable across query changes, time range changes / interval changes / panel resizes / template variable changes)
type TargetIdent = string;

// query + template variables + interval + raw time range
// used for full target cache busting -> full range re-query
type TargetSig = string;

type TimestampMs = number;

type StringInterpolator = (expr: string) => string;

// string matching requirements defined in durationutil.ts
export const defaultPrometheusQueryOverlapWindow = '10m';

interface TargetCache {
  sig: TargetSig;
  prevTo: TimestampMs;
  frames: DataFrame[];
}

export interface CacheRequestInfo {
  requests: Array<DataQueryRequest<PromQuery>>;
  targSigs: Map<TargetIdent, TargetSig>;
  shouldCache: boolean;
}

/**
 * Get field identity
 * This is the string used to uniquely identify a field within a "target"
 * @param field
 */
export const getFieldIdent = (field: Field) => `${field.type}|${field.name}|${JSON.stringify(field.labels ?? '')}`;

/**
 * Get target signature
 * @param targExpr
 * @param request
 * @param targ
 */
export function getTargSig(targExpr: string, request: DataQueryRequest<PromQuery>, targ: PromQuery) {
  return `${targExpr}|${targ.interval ?? request.interval}|${JSON.stringify(request.rangeRaw ?? '')}|${targ.exemplar}`;
}

/**
 * NOMENCLATURE
 * Target: The request target (DataQueryRequest), i.e. a specific query reference within a panel
 * Ident: Identity: the string that is not expected to change
 * Sig: Signature: the string that is expected to change, upon which we wipe the cache fields
 */
export class QueryCache {
  private overlapWindowMs;
  private perfObeserver?: PerformanceObserver;
  private pendingRequestIdsToTargSig: Record<string, Record<string, number | null>> = {};

  cache = new Map<TargetIdent, TargetCache>();

  constructor(overlapString?: string) {
    const unverifiedOverlap = overlapString ?? defaultPrometheusQueryOverlapWindow;

    if (isValidDuration(unverifiedOverlap)) {
      const duration = parseDuration(unverifiedOverlap);
      this.overlapWindowMs = durationToMilliseconds(duration);
    } else {
      const duration = parseDuration(defaultPrometheusQueryOverlapWindow);
      this.overlapWindowMs = durationToMilliseconds(duration);
    }
    this.profile();
  }

  private profile() {
    // Check if PerformanceObserver is supported, and if we have Faro enabled for internal profiling
    if (typeof PerformanceObserver === 'function' && config.grafanaJavascriptAgent.enabled) {
      this.perfObeserver = new PerformanceObserver((list: PerformanceObserverEntryList) => {
        list.getEntries().forEach((entry) => {
          // eslint-ignore-next-line
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

                // TODO: store full initial request size by targSig so we can diff follow-up partial requests
                // TODO: log savings between full initial request and incremental request to Faro
                const requestTransferSize = Math.round(entryTypeCast.transferSize);
                const idToBytes = this.pendingRequestIdsToTargSig[requestId];

                if (idToBytes) {
                  // Set the transfer size for this current request
                  Object.keys(idToBytes).forEach((key) => {
                    for (let otherRequestIds in this.pendingRequestIdsToTargSig) {
                      const firstKey = Object.keys(this.pendingRequestIdsToTargSig[otherRequestIds])[0];
                      const firstValue = Object.values(this.pendingRequestIdsToTargSig[otherRequestIds])[0];
                      if (firstKey === key && firstValue !== null) {
                        faro.api.pushEvent(
                          'prometheus incremental query response size',
                          {
                            id: firstKey,
                            initialRequestBytes: firstValue.toString(),
                            subsequentRequestBytes: requestTransferSize.toString(10),
                          },
                          'no-interaction',
                          {
                            skipDedupe: true,
                          }
                        );

                        delete this.pendingRequestIdsToTargSig[requestId];
                        break;
                      }
                    }

                    // Set the transfer size
                    idToBytes[key] = requestTransferSize;
                  });
                }
              }
            }
          }
        });
      });

      this.perfObeserver.observe({ type: 'resource', buffered: false });
    }
  }

  // can be used to change full range request to partial, split into multiple requests
  requestInfo(request: DataQueryRequest<PromQuery>, interpolateString: StringInterpolator): CacheRequestInfo {
    // TODO: align from/to to interval to increase probability of hitting backend cache
    const newFrom = request.range.from.valueOf();
    const newTo = request.range.to.valueOf();

    // only cache 'now'-relative queries (that can benefit from a backfill cache)
    const shouldCache = request.rangeRaw?.to?.toString() === 'now';

    // all targets are queried together, so we check for any that causes group cache invalidation & full re-query
    let doPartialQuery = shouldCache;
    let prevTo: TimestampMs;

    // pre-compute reqTargSigs
    const reqTargSigs = new Map<TargetIdent, TargetSig>();
    request.targets.forEach((targ) => {
      let targIdent = `${request.dashboardUID}|${request.panelId}|${targ.refId}`;
      let targExpr = interpolateString(targ.expr);
      let targSig = getTargSig(targExpr, request, targ); // ${request.maxDataPoints} ?

      if (!this.pendingRequestIdsToTargSig[request.requestId]) {
        this.pendingRequestIdsToTargSig[request.requestId] = {};
      }
      this.pendingRequestIdsToTargSig[request.requestId][targIdent + '|' + targSig] = null;

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

    if (doPartialQuery) {
      // 10m re-query overlap

      // clamp to make sure we don't re-query previous 10m when newFrom is ahead of it (e.g. 5min range, 30s refresh)
      let newFromPartial = Math.max(prevTo! - this.overlapWindowMs, newFrom);

      // modify to partial query
      request = {
        ...request,
        range: {
          ...request.range,
          from: dateTime(newFromPartial),
          to: dateTime(newTo),
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
    request: DataQueryRequest<PromQuery>,
    requestInfo: CacheRequestInfo | undefined,
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
            let prevTable: Table = cachedFrame.fields.map((field) => field.values.toArray()) as Table;
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            let nextTable: Table = respFrame.fields.map((field) => field.values.toArray()) as Table;

            let amendedTable = amendTable(prevTable, nextTable);
            if (amendedTable) {
              for (let i = 0; i < amendedTable.length; i++) {
                cachedFrame.fields[i].values = new ArrayVector(amendedTable[i]);
              }

              cachedFrame.length = cachedFrame.fields[0].values.length;
            } else {
              console.warn('No table, invalid merge!');
            }
          }
        });

        // trim all frames to in-view range, evict those that end up with 0 length
        let nonEmptyCachedFrames: DataFrame[] = [];

        cachedFrames.forEach((frame) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          let table: Table = frame.fields.map((field) => field.values.toArray()) as Table;

          let trimmed = trimTable(table, newFrom, newTo);

          if (trimmed[0].length > 0) {
            for (let i = 0; i < trimmed.length; i++) {
              frame.fields[i].values = new ArrayVector(trimmed[i]);
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
          values: new ArrayVector(field.values.toArray().slice()),
        })),
      }));
    }

    return respFrames;
  }
}
