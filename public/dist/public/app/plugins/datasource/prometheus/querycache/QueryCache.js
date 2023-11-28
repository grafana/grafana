import { dateTime, durationToMilliseconds, incrRoundDn, isValidDuration, parseDuration, } from '@grafana/data/src';
import { faro } from '@grafana/faro-web-sdk';
import { config, reportInteraction } from '@grafana/runtime/src';
import { amendTable, trimTable } from 'app/features/live/data/amendTimeSeries';
import { getTimeSrv } from '../../../../features/dashboard/services/TimeSrv';
// string matching requirements defined in durationutil.ts
export const defaultPrometheusQueryOverlapWindow = '10m';
/**
 * Get field identity
 * This is the string used to uniquely identify a field within a "target"
 * @param field
 */
export const getFieldIdent = (field) => { var _a; return `${field.type}|${field.name}|${JSON.stringify((_a = field.labels) !== null && _a !== void 0 ? _a : '')}`; };
/**
 * NOMENCLATURE
 * Target: The request target (DataQueryRequest), i.e. a specific query reference within a panel
 * Ident: Identity: the string that is not expected to change
 * Sig: Signature: the string that is expected to change, upon which we wipe the cache fields
 */
export class QueryCache {
    constructor(options) {
        var _a;
        // send profile events every 10 minutes
        this.sendEventsInterval = 60000 * 10;
        this.pendingRequestIdsToTargSigs = new Map();
        this.pendingAccumulatedEvents = new Map();
        this.cache = new Map();
        this.sendPendingTrackingEvents = () => {
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
                    }
                    else if (faro.api.pushEvent) {
                        faro.api.pushEvent('incremental query response size', event, 'no-interaction', {
                            skipDedupe: true,
                        });
                    }
                    this.pendingAccumulatedEvents.set(key, Object.assign(Object.assign({}, value), { sent: true, requestCount: 0, savedBytesTotal: 0, initialRequestSize: 0, lastRequestSize: 0 }));
                }
            }
        };
        const unverifiedOverlap = options.overlapString;
        if (isValidDuration(unverifiedOverlap)) {
            const duration = parseDuration(unverifiedOverlap);
            this.overlapWindowMs = durationToMilliseconds(duration);
        }
        else {
            const duration = parseDuration(defaultPrometheusQueryOverlapWindow);
            this.overlapWindowMs = durationToMilliseconds(duration);
        }
        if ((config.grafanaJavascriptAgent.enabled || ((_a = config.featureToggles) === null || _a === void 0 ? void 0 : _a.prometheusIncrementalQueryInstrumentation)) &&
            options.profileFunction !== undefined) {
            this.profile();
            this.shouldProfile = true;
        }
        else {
            this.shouldProfile = false;
        }
        this.getProfileData = options.profileFunction;
        this.getTargetSignature = options.getTargetSignature;
    }
    profile() {
        // Check if PerformanceObserver is supported, and if we have Faro enabled for internal profiling
        if (typeof PerformanceObserver === 'function') {
            this.perfObeserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    const entryTypeCast = entry;
                    // Safari support for this is coming in 16.4:
                    // https://caniuse.com/mdn-api_performanceresourcetiming_transfersize
                    // Gating that this exists to prevent runtime errors
                    const isSupported = typeof (entryTypeCast === null || entryTypeCast === void 0 ? void 0 : entryTypeCast.transferSize) === 'number';
                    if ((entryTypeCast === null || entryTypeCast === void 0 ? void 0 : entryTypeCast.initiatorType) === 'fetch' && isSupported) {
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
                                                datasource: (_a = value.datasource) !== null && _a !== void 0 ? _a : 'N/A',
                                                requestCount: ((_b = previous === null || previous === void 0 ? void 0 : previous.requestCount) !== null && _b !== void 0 ? _b : 0) + 1,
                                                savedBytesTotal: ((_c = previous === null || previous === void 0 ? void 0 : previous.savedBytesTotal) !== null && _c !== void 0 ? _c : 0) + savedBytes,
                                                initialRequestSize: value.bytes,
                                                lastRequestSize: requestTransferSize,
                                                panelId: (_e = (_d = currentRequest.panelId) === null || _d === void 0 ? void 0 : _d.toString()) !== null && _e !== void 0 ? _e : '',
                                                dashId: (_f = currentRequest.dashboardUID) !== null && _f !== void 0 ? _f : '',
                                                expr: (_g = currentRequest.expr) !== null && _g !== void 0 ? _g : '',
                                                refreshIntervalMs: (_h = currentRequest.refreshIntervalMs) !== null && _h !== void 0 ? _h : 0,
                                                sent: false,
                                                from: (_j = currentRequest.from) !== null && _j !== void 0 ? _j : '',
                                                queryRangeSeconds: (_k = currentRequest.queryRangeSeconds) !== null && _k !== void 0 ? _k : 0,
                                            });
                                            // We don't need to save each subsequent request, only the first one
                                            this.pendingRequestIdsToTargSigs.delete(requestId);
                                            return;
                                        }
                                    }
                                    // If we didn't return above, this should be the first request, let's save the observed size
                                    this.pendingRequestIdsToTargSigs.set(requestId, Object.assign(Object.assign({}, currentRequest), { bytes: requestTransferSize }));
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
    // can be used to change full range request to partial, split into multiple requests
    requestInfo(request) {
        // TODO: align from/to to interval to increase probability of hitting backend cache
        var _a, _b, _c;
        const newFrom = request.range.from.valueOf();
        const newTo = request.range.to.valueOf();
        // only cache 'now'-relative queries (that can benefit from a backfill cache)
        const shouldCache = ((_b = (_a = request.rangeRaw) === null || _a === void 0 ? void 0 : _a.to) === null || _b === void 0 ? void 0 : _b.toString()) === 'now';
        // all targets are queried together, so we check for any that causes group cache invalidation & full re-query
        let doPartialQuery = shouldCache;
        let prevTo = undefined;
        const refreshIntervalMs = getTimeSrv().refreshMS;
        // pre-compute reqTargSigs
        const reqTargSigs = new Map();
        request.targets.forEach((targ) => {
            var _a, _b, _c, _d;
            let targIdent = `${request.dashboardUID}|${request.panelId}|${targ.refId}`;
            let targSig = this.getTargetSignature(request, targ); // ${request.maxDataPoints} ?
            if (this.shouldProfile && this.getProfileData) {
                this.pendingRequestIdsToTargSigs.set(request.requestId, Object.assign(Object.assign({}, this.getProfileData(request, targ)), { identity: targIdent + '|' + targSig, bytes: null, panelId: request.panelId, dashboardUID: (_a = request.dashboardUID) !== null && _a !== void 0 ? _a : '', from: (_c = (_b = request.rangeRaw) === null || _b === void 0 ? void 0 : _b.from.toString()) !== null && _c !== void 0 ? _c : '', queryRangeSeconds: (_d = request.range.to.diff(request.range.from, 'seconds')) !== null && _d !== void 0 ? _d : '', refreshIntervalMs: refreshIntervalMs !== null && refreshIntervalMs !== void 0 ? refreshIntervalMs : 0 }));
            }
            reqTargSigs.set(targIdent, targSig);
        });
        // figure out if new query range or new target props trigger full cache invalidation & re-query
        for (const [targIdent, targSig] of reqTargSigs) {
            let cached = this.cache.get(targIdent);
            let cachedSig = cached === null || cached === void 0 ? void 0 : cached.sig;
            if (cachedSig !== targSig) {
                doPartialQuery = false;
            }
            else {
                // only do partial queries when new request range follows prior request range (possibly with overlap)
                // e.g. now-6h with refresh <= 6h
                prevTo = (_c = cached === null || cached === void 0 ? void 0 : cached.prevTo) !== null && _c !== void 0 ? _c : Infinity;
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
            request = Object.assign(Object.assign({}, request), { range: Object.assign(Object.assign({}, request.range), { from: newFromPartialDate, to: newToDate }) });
        }
        else {
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
    procFrames(request, requestInfo, respFrames) {
        if (requestInfo === null || requestInfo === void 0 ? void 0 : requestInfo.shouldCache) {
            const newFrom = request.range.from.valueOf();
            const newTo = request.range.to.valueOf();
            // group frames by targets
            const respByTarget = new Map();
            respFrames.forEach((frame) => {
                let targIdent = `${request.dashboardUID}|${request.panelId}|${frame.refId}`;
                let frames = respByTarget.get(targIdent);
                if (!frames) {
                    frames = [];
                    respByTarget.set(targIdent, frames);
                }
                frames.push(frame);
            });
            let outFrames = [];
            respByTarget.forEach((respFrames, targIdent) => {
                var _a, _b;
                let cachedFrames = (_b = (targIdent ? (_a = this.cache.get(targIdent)) === null || _a === void 0 ? void 0 : _a.frames : null)) !== null && _b !== void 0 ? _b : [];
                respFrames.forEach((respFrame) => {
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
                    }
                    else {
                        // we assume that fields cannot appear/disappear and will all exist in same order
                        // amend & re-cache
                        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                        let prevTable = cachedFrame.fields.map((field) => field.values);
                        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                        let nextTable = respFrame.fields.map((field) => field.values);
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
                let nonEmptyCachedFrames = [];
                cachedFrames.forEach((frame) => {
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    let table = frame.fields.map((field) => field.values);
                    let trimmed = trimTable(table, newFrom, newTo);
                    if (trimmed[0].length > 0) {
                        for (let i = 0; i < trimmed.length; i++) {
                            frame.fields[i].values = trimmed[i];
                        }
                        nonEmptyCachedFrames.push(frame);
                    }
                });
                this.cache.set(targIdent, {
                    sig: requestInfo.targSigs.get(targIdent),
                    frames: nonEmptyCachedFrames,
                    prevTo: newTo,
                });
                outFrames.push(...nonEmptyCachedFrames);
            });
            // transformV2 mutates field values for heatmap de-accum, and modifies field order, so we gotta clone here, for now :(
            respFrames = outFrames.map((frame) => (Object.assign(Object.assign({}, frame), { fields: frame.fields.map((field) => (Object.assign(Object.assign({}, field), { config: Object.assign({}, field.config), values: field.values.slice() }))) })));
        }
        return respFrames;
    }
}
//# sourceMappingURL=QueryCache.js.map