import { __values } from "tslib";
import { defaults } from 'lodash';
import { Observable } from 'rxjs';
import { FieldType, CircularDataFrame, CSVReader, LoadingState, StreamingDataFrame, } from '@grafana/data';
import { getRandomLine } from './LogIpsum';
import { liveTimer } from 'app/features/dashboard/dashgrid/liveTimer';
export var defaultStreamQuery = {
    type: 'signal',
    speed: 250,
    spread: 3.5,
    noise: 2.2,
    bands: 1,
};
export function runStream(target, req) {
    var query = defaults(target.stream, defaultStreamQuery);
    if ('signal' === query.type) {
        return runSignalStream(target, query, req);
    }
    if ('logs' === query.type) {
        return runLogsStream(target, query, req);
    }
    if ('fetch' === query.type) {
        return runFetchStream(target, query, req);
    }
    throw new Error("Unknown Stream Type: " + query.type);
}
export function runSignalStream(target, query, req) {
    return new Observable(function (subscriber) {
        var streamId = "signal-" + req.panelId + "-" + target.refId;
        var maxDataPoints = req.maxDataPoints || 1000;
        var schema = {
            refId: target.refId,
            name: target.alias || 'Signal ' + target.refId,
            fields: [
                { name: 'time', type: FieldType.time },
                { name: 'value', type: FieldType.number },
            ],
        };
        var spread = query.spread, speed = query.speed, _a = query.bands, bands = _a === void 0 ? 0 : _a, noise = query.noise;
        for (var i = 0; i < bands; i++) {
            var suffix = bands > 1 ? " " + (i + 1) : '';
            schema.fields.push({ name: 'Min' + suffix, type: FieldType.number });
            schema.fields.push({ name: 'Max' + suffix, type: FieldType.number });
        }
        var frame = new StreamingDataFrame({ schema: schema }, { maxLength: maxDataPoints });
        var value = Math.random() * 100;
        var timeoutId = null;
        var lastSent = -1;
        var addNextRow = function (time) {
            value += (Math.random() - 0.5) * spread;
            var data = {
                values: [[time], [value]],
            };
            var min = value;
            var max = value;
            for (var i = 0; i < bands; i++) {
                min = min - Math.random() * noise;
                max = max + Math.random() * noise;
                data.values.push([min]);
                data.values.push([max]);
            }
            var event = { data: data };
            return frame.push(event);
        };
        // Fill the buffer on init
        if (true) {
            var time = Date.now() - maxDataPoints * speed;
            for (var i = 0; i < maxDataPoints; i++) {
                addNextRow(time);
                time += speed;
            }
        }
        var pushNextEvent = function () {
            addNextRow(Date.now());
            var elapsed = liveTimer.lastUpdate - lastSent;
            if (elapsed > 1000 || liveTimer.ok) {
                subscriber.next({
                    data: [frame],
                    key: streamId,
                    state: LoadingState.Streaming,
                });
                lastSent = liveTimer.lastUpdate;
            }
            timeoutId = setTimeout(pushNextEvent, speed);
        };
        // Send first event in 5ms
        setTimeout(pushNextEvent, 5);
        return function () {
            console.log('unsubscribing to stream ' + streamId);
            clearTimeout(timeoutId);
        };
    });
}
export function runLogsStream(target, query, req) {
    return new Observable(function (subscriber) {
        var streamId = "logs-" + req.panelId + "-" + target.refId;
        var maxDataPoints = req.maxDataPoints || 1000;
        var data = new CircularDataFrame({
            append: 'tail',
            capacity: maxDataPoints,
        });
        data.refId = target.refId;
        data.name = target.alias || 'Logs ' + target.refId;
        data.addField({ name: 'line', type: FieldType.string });
        data.addField({ name: 'time', type: FieldType.time });
        data.meta = { preferredVisualisationType: 'logs' };
        var speed = query.speed;
        var timeoutId = null;
        var pushNextEvent = function () {
            data.fields[0].values.add(Date.now());
            data.fields[1].values.add(getRandomLine());
            subscriber.next({
                data: [data],
                key: streamId,
            });
            timeoutId = setTimeout(pushNextEvent, speed);
        };
        // Send first event in 5ms
        setTimeout(pushNextEvent, 5);
        return function () {
            console.log('unsubscribing to stream ' + streamId);
            clearTimeout(timeoutId);
        };
    });
}
export function runFetchStream(target, query, req) {
    return new Observable(function (subscriber) {
        var streamId = "fetch-" + req.panelId + "-" + target.refId;
        var maxDataPoints = req.maxDataPoints || 1000;
        var data = new CircularDataFrame({
            append: 'tail',
            capacity: maxDataPoints,
        });
        data.refId = target.refId;
        data.name = target.alias || 'Fetch ' + target.refId;
        var reader;
        var csv = new CSVReader({
            callback: {
                onHeader: function (fields) {
                    var e_1, _a;
                    // Clear any existing fields
                    if (data.fields.length) {
                        data = new CircularDataFrame({
                            append: 'tail',
                            capacity: maxDataPoints,
                        });
                        data.refId = target.refId;
                        data.name = 'Fetch ' + target.refId;
                    }
                    try {
                        for (var fields_1 = __values(fields), fields_1_1 = fields_1.next(); !fields_1_1.done; fields_1_1 = fields_1.next()) {
                            var field = fields_1_1.value;
                            data.addField(field);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (fields_1_1 && !fields_1_1.done && (_a = fields_1.return)) _a.call(fields_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                },
                onRow: function (row) {
                    data.add(row);
                },
            },
        });
        var processChunk = function (value) {
            if (value.value) {
                var text = new TextDecoder().decode(value.value);
                csv.readCSV(text);
            }
            subscriber.next({
                data: [data],
                key: streamId,
                state: value.done ? LoadingState.Done : LoadingState.Streaming,
            });
            if (value.done) {
                console.log('Finished stream');
                subscriber.complete(); // necessary?
                return;
            }
            return reader.read().then(processChunk);
        };
        if (!query.url) {
            throw new Error('query.url is not defined');
        }
        fetch(new Request(query.url)).then(function (response) {
            if (response.body) {
                reader = response.body.getReader();
                reader.read().then(processChunk);
            }
        });
        return function () {
            // Cancel fetch?
            console.log('unsubscribing to stream ' + streamId);
        };
    });
}
//# sourceMappingURL=runStreams.js.map