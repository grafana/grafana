import { defaults } from 'lodash';
import { Observable } from 'rxjs';
import { FieldType, CircularDataFrame, CSVReader, LoadingState, StreamingDataFrame, } from '@grafana/data';
import { getRandomLine } from './LogIpsum';
export const defaultStreamQuery = {
    type: 'signal',
    speed: 250,
    spread: 3.5,
    noise: 2.2,
    bands: 1,
};
export function runStream(target, req) {
    const query = defaults(target.stream, defaultStreamQuery);
    if ('signal' === query.type) {
        return runSignalStream(target, query, req);
    }
    if ('logs' === query.type) {
        return runLogsStream(target, query, req);
    }
    if ('fetch' === query.type) {
        return runFetchStream(target, query, req);
    }
    throw new Error(`Unknown Stream Type: ${query.type}`);
}
export function runSignalStream(target, query, req) {
    return new Observable((subscriber) => {
        var _a;
        const streamId = `signal-${req.panelId}-${target.refId}`;
        const maxDataPoints = req.maxDataPoints || 1000;
        const schema = {
            refId: target.refId,
            fields: [
                { name: 'time', type: FieldType.time },
                { name: (_a = target.alias) !== null && _a !== void 0 ? _a : 'value', type: FieldType.number },
            ],
        };
        const { spread, speed, bands = 0, noise } = query;
        for (let i = 0; i < bands; i++) {
            const suffix = bands > 1 ? ` ${i + 1}` : '';
            schema.fields.push({ name: 'Min' + suffix, type: FieldType.number });
            schema.fields.push({ name: 'Max' + suffix, type: FieldType.number });
        }
        const frame = StreamingDataFrame.fromDataFrameJSON({ schema }, { maxLength: maxDataPoints });
        let value = Math.random() * 100;
        let timeoutId;
        let lastSent = -1;
        const addNextRow = (time) => {
            value += (Math.random() - 0.5) * spread;
            const data = {
                values: [[time], [value]],
            };
            let min = value;
            let max = value;
            for (let i = 0; i < bands; i++) {
                min = min - Math.random() * noise;
                max = max + Math.random() * noise;
                data.values.push([min]);
                data.values.push([max]);
            }
            const event = { data };
            return frame.push(event);
        };
        // Fill the buffer on init
        if (true) {
            let time = Date.now() - maxDataPoints * speed;
            for (let i = 0; i < maxDataPoints; i++) {
                addNextRow(time);
                time += speed;
            }
        }
        const pushNextEvent = () => {
            lastSent = Date.now();
            addNextRow(lastSent);
            subscriber.next({
                data: [frame],
                key: streamId,
                state: LoadingState.Streaming,
            });
            timeoutId = setTimeout(pushNextEvent, speed);
        };
        // Send first event in 5ms
        setTimeout(pushNextEvent, 5);
        return () => {
            console.log('unsubscribing to stream ' + streamId);
            clearTimeout(timeoutId);
        };
    });
}
export function runLogsStream(target, query, req) {
    return new Observable((subscriber) => {
        const streamId = `logs-${req.panelId}-${target.refId}`;
        const maxDataPoints = req.maxDataPoints || 1000;
        const data = new CircularDataFrame({
            append: 'tail',
            capacity: maxDataPoints,
        });
        data.refId = target.refId;
        data.name = target.alias || 'Logs ' + target.refId;
        data.addField({ name: 'line', type: FieldType.string });
        data.addField({ name: 'time', type: FieldType.time });
        data.meta = { preferredVisualisationType: 'logs' };
        const { speed } = query;
        let timeoutId;
        const pushNextEvent = () => {
            data.fields[0].values.push(getRandomLine());
            data.fields[1].values.push(Date.now());
            subscriber.next({
                data: [data],
                key: streamId,
            });
            timeoutId = setTimeout(pushNextEvent, speed);
        };
        // Send first event in 5ms
        setTimeout(pushNextEvent, 5);
        return () => {
            console.log('unsubscribing to stream ' + streamId);
            clearTimeout(timeoutId);
        };
    });
}
export function runFetchStream(target, query, req) {
    return new Observable((subscriber) => {
        const streamId = `fetch-${req.panelId}-${target.refId}`;
        const maxDataPoints = req.maxDataPoints || 1000;
        let data = new CircularDataFrame({
            append: 'tail',
            capacity: maxDataPoints,
        });
        data.refId = target.refId;
        data.name = target.alias || 'Fetch ' + target.refId;
        let reader;
        const csv = new CSVReader({
            callback: {
                onHeader: (fields) => {
                    // Clear any existing fields
                    if (data.fields.length) {
                        data = new CircularDataFrame({
                            append: 'tail',
                            capacity: maxDataPoints,
                        });
                        data.refId = target.refId;
                        data.name = 'Fetch ' + target.refId;
                    }
                    for (const field of fields) {
                        data.addField(field);
                    }
                },
                onRow: (row) => {
                    data.add(row);
                },
            },
        });
        const processChunk = (value) => {
            if (value.value) {
                const text = new TextDecoder().decode(value.value);
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
        fetch(new Request(query.url)).then((response) => {
            if (response.body) {
                reader = response.body.getReader();
                reader.read().then(processChunk);
            }
        });
        return () => {
            // Cancel fetch?
            console.log('unsubscribing to stream ' + streamId);
        };
    });
}
//# sourceMappingURL=runStreams.js.map