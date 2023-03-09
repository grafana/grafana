import { ArrayVector, DataFrame, DataQueryRequest, dateTime, Field } from '@grafana/data';
import { amendTable, trimTable } from 'app/features/live/data/amendTimeSeries';

import { PromQuery } from './types';

// dashboardUID + panelId + refId
// (must be stable across query changes, time range changes / interval changes / panel resizes / template variable changes)
type TargetIdent = string;

// query + template variables + interval + raw time range
// used for full target cache busting -> full range re-query
type TargetSig = string;

type TimestampMs = number;

type StringInterpolator = (expr: string) => string;

interface TargetCache {
  sig: TargetSig;
  prevTo: TimestampMs;
  frames: DataFrame[];
}

interface RequestInfo {
  requests: Array<DataQueryRequest<PromQuery>>;
  targSigs: Map<TargetIdent, TargetSig>;
  shouldCache: boolean;
}

export const getFieldIdent = (field: Field) => `${field.type}|${field.name}|${JSON.stringify(field.labels ?? '')}`;

export class QueryCache {
  cache = new Map<TargetIdent, TargetCache>();

  // can be used to change full range request to partial, split into multiple requests
  requestInfo(request: DataQueryRequest<PromQuery>, interpolateString: StringInterpolator): RequestInfo {
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
      let targSig = `${targExpr}|${request.intervalMs}|${JSON.stringify(request.rangeRaw ?? '')}`; // ${request.maxDataPoints} ?

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

    // console.log(`${doPartialQuery ? 'partial' : 'full'} query`);

    if (doPartialQuery) {
      // 10m re-query overlap
      const requeryLastMs = 10 * 60 * 1000;

      // clamp to make sure we don't re-query previous 10m when newFrom is ahead of it (e.g. 5min range, 30s refresh)
      let newFromPartial = Math.max(prevTo! - requeryLastMs, newFrom);

      // console.log(`query previous ${(newTo - newFromPartial) / 1000 / 60} mins`);

      // align the query to the interval to increase the chance of hitting the backend cache
      // ASK: how to test if this actually has desired effect?
      // ASK: does the backend already do this anyways? do we need to do it here?
      // newFromPartial = incrRoundDn(newFromPartial, request.intervalMs);
      // newToPartial = incrRoundDn(newTo, request.intervalMs);

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

        // TODO: figure out how to purge caches of targets that have permanently stopped making queries
        // - dashboard deleted (dashboardUID)
        // - panel removed (panelId),
        // - query removed (refId)
      });
    }

    return {
      requests: [request],
      targSigs: reqTargSigs,
      shouldCache,
    };
  }

  // should amend existing cache with new frames and return full response
  procFrames(request: DataQueryRequest<PromQuery>, requestInfo: RequestInfo, respFrames: DataFrame[]): DataFrame[] {
    if (requestInfo.shouldCache) {
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
            let prevTable = cachedFrame.fields.map((field) => field.values.toArray());
            let nextTable = respFrame.fields.map((field) => field.values.toArray());

            let amendedTable = amendTable(prevTable, nextTable);

            for (let i = 0; i < amendedTable.length; i++) {
              cachedFrame.fields[i].values = new ArrayVector(amendedTable[i]);
            }

            cachedFrame.length = cachedFrame.fields[0].values.length;
          }
        });

        // trim all frames to in-view range, evict those that end up with 0 length
        let nonEmptyCachedFrames: DataFrame[] = [];

        cachedFrames.forEach((frame) => {
          let table = frame.fields.map((field) => field.values.toArray());

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
