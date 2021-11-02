import { __assign, __awaiter, __generator, __values } from "tslib";
// Libraries
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';
// Components
import { selectors as editorSelectors } from '@grafana/e2e-selectors';
import { InlineField, InlineFieldRow, InlineSwitch, Input, Select, TextArea } from '@grafana/ui';
import { RandomWalkEditor, StreamingClientEditor } from './components';
import { PredictablePulseEditor } from './components/PredictablePulseEditor';
import { CSVWavesEditor } from './components/CSVWaveEditor';
import { defaultCSVWaveQuery, defaultPulseQuery, defaultQuery } from './constants';
import { GrafanaLiveEditor } from './components/GrafanaLiveEditor';
import { NodeGraphEditor } from './components/NodeGraphEditor';
import { defaultStreamQuery } from './runStreams';
import { CSVFileEditor } from './components/CSVFileEditor';
import { CSVContentEditor } from './components/CSVContentEditor';
import { USAQueryEditor, usaQueryModes } from './components/USAQueryEditor';
var showLabelsFor = ['random_walk', 'predictable_pulse'];
var endpoints = [
    { value: 'datasources', label: 'Data Sources' },
    { value: 'search', label: 'Search' },
    { value: 'annotations', label: 'Annotations' },
];
var selectors = editorSelectors.components.DataSource.TestData.QueryTab;
export var QueryEditor = function (_a) {
    var _b;
    var query = _a.query, datasource = _a.datasource, onChange = _a.onChange, onRunQuery = _a.onRunQuery;
    query = __assign(__assign({}, defaultQuery), query);
    var _c = useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        var csvContent, _a, _b, point;
        var e_1, _c;
        return __generator(this, function (_d) {
            // migrate manual_entry (unusable since 7, removed in 8)
            if (query.scenarioId === 'manual_entry' && query.points) {
                csvContent = 'Time,Value\n';
                try {
                    for (_a = __values(query.points), _b = _a.next(); !_b.done; _b = _a.next()) {
                        point = _b.value;
                        csvContent += point[1] + "," + point[0] + "\n";
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                onChange({
                    refId: query.refId,
                    datasource: query.datasource,
                    scenarioId: 'csv_content',
                    csvContent: csvContent,
                });
            }
            return [2 /*return*/, datasource.getScenarios()];
        });
    }); }, []), loading = _c.loading, scenarioList = _c.value;
    var onUpdate = function (query) {
        onChange(query);
        onRunQuery();
    };
    var currentScenario = useMemo(function () { return scenarioList === null || scenarioList === void 0 ? void 0 : scenarioList.find(function (scenario) { return scenario.id === query.scenarioId; }); }, [
        scenarioList,
        query,
    ]);
    var scenarioId = currentScenario === null || currentScenario === void 0 ? void 0 : currentScenario.id;
    var onScenarioChange = function (item) {
        var scenario = scenarioList === null || scenarioList === void 0 ? void 0 : scenarioList.find(function (sc) { return sc.id === item.value; });
        if (!scenario) {
            return;
        }
        // Clear model from existing props that belong to other scenarios
        var update = {
            scenarioId: item.value,
            refId: query.refId,
            alias: query.alias,
        };
        if (scenario.stringInput) {
            update.stringInput = scenario.stringInput;
        }
        switch (scenario.id) {
            case 'grafana_api':
                update.stringInput = 'datasources';
                break;
            case 'streaming_client':
                update.stream = defaultStreamQuery;
                break;
            case 'live':
                update.channel = 'random-2s-stream'; // default stream
                break;
            case 'predictable_pulse':
                update.pulseWave = defaultPulseQuery;
                break;
            case 'predictable_csv_wave':
                update.csvWave = defaultCSVWaveQuery;
                break;
            case 'usa':
                update.usa = {
                    mode: usaQueryModes[0].value,
                };
        }
        onUpdate(update);
    };
    var onInputChange = function (e) {
        var _a;
        var _b = e.target, name = _b.name, value = _b.value, type = _b.type;
        var newValue = value;
        if (type === 'number') {
            newValue = Number(value);
        }
        if (name === 'levelColumn') {
            newValue = e.target.checked;
        }
        onUpdate(__assign(__assign({}, query), (_a = {}, _a[name] = newValue, _a)));
    };
    var onFieldChange = function (field) { return function (e) {
        var _a, _b;
        var _c = e.target, name = _c.name, value = _c.value, type = _c.type;
        var newValue = value;
        if (type === 'number') {
            newValue = Number(value);
        }
        onUpdate(__assign(__assign({}, query), (_a = {}, _a[field] = __assign(__assign({}, query[field]), (_b = {}, _b[name] = newValue, _b)), _a)));
    }; };
    var onEndPointChange = function (_a) {
        var value = _a.value;
        onUpdate(__assign(__assign({}, query), { stringInput: value }));
    };
    var onStreamClientChange = onFieldChange('stream');
    var onPulseWaveChange = onFieldChange('pulseWave');
    var onUSAStatsChange = function (usa) {
        onUpdate(__assign(__assign({}, query), { usa: usa }));
    };
    var onCSVWaveChange = function (csvWave) {
        onUpdate(__assign(__assign({}, query), { csvWave: csvWave }));
    };
    var options = useMemo(function () {
        return (scenarioList || [])
            .map(function (item) { return ({ label: item.name, value: item.id }); })
            .sort(function (a, b) { return a.label.localeCompare(b.label); });
    }, [scenarioList]);
    var showLabels = useMemo(function () { return showLabelsFor.includes(query.scenarioId); }, [query]);
    if (loading) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, { "aria-label": selectors.scenarioSelectContainer },
            React.createElement(InlineField, { labelWidth: 14, label: "Scenario" },
                React.createElement(Select, { inputId: "test-data-scenario-select-" + query.refId, menuShouldPortal: true, options: options, value: options.find(function (item) { return item.value === query.scenarioId; }), onChange: onScenarioChange, width: 32 })),
            (currentScenario === null || currentScenario === void 0 ? void 0 : currentScenario.stringInput) && (React.createElement(InlineField, { label: "String Input" },
                React.createElement(Input, { width: 32, id: "stringInput-" + query.refId, name: "stringInput", placeholder: query.stringInput, value: query.stringInput, onChange: onInputChange }))),
            React.createElement(InlineField, { label: "Alias", labelWidth: 14 },
                React.createElement(Input, { width: 32, id: "alias-" + query.refId, type: "text", placeholder: "optional", pattern: '[^<>&\\\\"]+', name: "alias", value: query.alias, onChange: onInputChange })),
            showLabels && (React.createElement(InlineField, { label: "Labels", labelWidth: 14, tooltip: React.createElement(React.Fragment, null,
                    "Set labels using a key=value syntax:",
                    React.createElement("br", null), "{ key = \"value\", key2 = \"value\" }",
                    React.createElement("br", null),
                    "key=\"value\", key2=\"value\"",
                    React.createElement("br", null),
                    "key=value, key2=value",
                    React.createElement("br", null)) },
                React.createElement(Input, { width: 32, id: "labels-" + query.refId, name: "labels", onChange: onInputChange, value: query === null || query === void 0 ? void 0 : query.labels, placeholder: "key=value, key2=value2" })))),
        scenarioId === 'random_walk' && React.createElement(RandomWalkEditor, { onChange: onInputChange, query: query }),
        scenarioId === 'streaming_client' && React.createElement(StreamingClientEditor, { onChange: onStreamClientChange, query: query }),
        scenarioId === 'live' && React.createElement(GrafanaLiveEditor, { onChange: onUpdate, query: query }),
        scenarioId === 'csv_file' && React.createElement(CSVFileEditor, { onChange: onUpdate, query: query }),
        scenarioId === 'csv_content' && React.createElement(CSVContentEditor, { onChange: onUpdate, query: query }),
        scenarioId === 'logs' && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Lines", labelWidth: 14 },
                React.createElement(Input, { type: "number", name: "lines", value: query.lines, width: 32, onChange: onInputChange, placeholder: "10" })),
            React.createElement(InlineField, { label: "Level", labelWidth: 14 },
                React.createElement(InlineSwitch, { onChange: onInputChange, name: "levelColumn", value: !!query.levelColumn })))),
        scenarioId === 'usa' && React.createElement(USAQueryEditor, { onChange: onUSAStatsChange, query: (_b = query.usa) !== null && _b !== void 0 ? _b : {} }),
        scenarioId === 'grafana_api' && (React.createElement(InlineField, { labelWidth: 14, label: "Endpoint" },
            React.createElement(Select, { menuShouldPortal: true, options: endpoints, onChange: onEndPointChange, width: 32, value: endpoints.find(function (ep) { return ep.value === query.stringInput; }) }))),
        scenarioId === 'arrow' && (React.createElement(InlineField, { grow: true },
            React.createElement(TextArea, { name: "stringInput", value: query.stringInput, rows: 10, placeholder: "Copy base64 text data from query result", onChange: onInputChange }))),
        scenarioId === 'predictable_pulse' && React.createElement(PredictablePulseEditor, { onChange: onPulseWaveChange, query: query }),
        scenarioId === 'predictable_csv_wave' && React.createElement(CSVWavesEditor, { onChange: onCSVWaveChange, waves: query.csvWave }),
        scenarioId === 'node_graph' && (React.createElement(NodeGraphEditor, { onChange: function (val) { return onChange(__assign(__assign({}, query), { nodes: val })); }, query: query }))));
};
//# sourceMappingURL=QueryEditor.js.map