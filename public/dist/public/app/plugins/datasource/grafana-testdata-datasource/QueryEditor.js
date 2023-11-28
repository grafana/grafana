import { __awaiter } from "tslib";
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';
import { selectors as editorSelectors } from '@grafana/e2e-selectors';
import { InlineField, InlineFieldRow, InlineSwitch, Input, Select, Icon, TextArea } from '@grafana/ui';
import { RandomWalkEditor, StreamingClientEditor } from './components';
import { CSVContentEditor } from './components/CSVContentEditor';
import { CSVFileEditor } from './components/CSVFileEditor';
import { CSVWavesEditor } from './components/CSVWaveEditor';
import ErrorEditor from './components/ErrorEditor';
import { GrafanaLiveEditor } from './components/GrafanaLiveEditor';
import { NodeGraphEditor } from './components/NodeGraphEditor';
import { PredictablePulseEditor } from './components/PredictablePulseEditor';
import { RawFrameEditor } from './components/RawFrameEditor';
import { SimulationQueryEditor } from './components/SimulationQueryEditor';
import { USAQueryEditor, usaQueryModes } from './components/USAQueryEditor';
import { defaultCSVWaveQuery, defaultPulseQuery, defaultQuery } from './constants';
import { TestDataQueryType } from './dataquery.gen';
import { defaultStreamQuery } from './runStreams';
const endpoints = [
    { value: 'datasources', label: 'Data Sources' },
    { value: 'search', label: 'Search' },
    { value: 'annotations', label: 'Annotations' },
];
const selectors = editorSelectors.components.DataSource.TestData.QueryTab;
export const QueryEditor = ({ query, datasource, onChange, onRunQuery }) => {
    var _a;
    query = Object.assign(Object.assign({}, defaultQuery), query);
    const { loading, value: scenarioList } = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        // migrate manual_entry (unusable since 7, removed in 8)
        if (query.scenarioId === TestDataQueryType.ManualEntry && query.points) {
            let csvContent = 'Time,Value\n';
            for (const point of query.points) {
                csvContent += `${point[1]},${point[0]}\n`;
            }
            onChange({
                refId: query.refId,
                datasource: query.datasource,
                scenarioId: TestDataQueryType.CSVContent,
                csvContent,
            });
        }
        const vals = yield datasource.getScenarios();
        const hideAlias = [TestDataQueryType.Simulation, TestDataQueryType.Annotations];
        return vals.map((v) => (Object.assign(Object.assign({}, v), { hideAliasField: hideAlias.includes(v.id) })));
    }), []);
    const onUpdate = (query) => {
        onChange(query);
        onRunQuery();
    };
    const currentScenario = useMemo(() => scenarioList === null || scenarioList === void 0 ? void 0 : scenarioList.find((scenario) => scenario.id === query.scenarioId), [scenarioList, query]);
    const scenarioId = currentScenario === null || currentScenario === void 0 ? void 0 : currentScenario.id;
    const description = currentScenario === null || currentScenario === void 0 ? void 0 : currentScenario.description;
    const onScenarioChange = (item) => {
        const scenario = scenarioList === null || scenarioList === void 0 ? void 0 : scenarioList.find((sc) => sc.id === item.value);
        if (!scenario) {
            return;
        }
        // Clear model from existing props that belong to other scenarios
        const update = {
            scenarioId: item.value,
            refId: query.refId,
            alias: query.alias,
            datasource: query.datasource,
        };
        if (scenario.stringInput) {
            update.stringInput = scenario.stringInput;
        }
        switch (scenario.id) {
            case TestDataQueryType.GrafanaAPI:
                update.stringInput = 'datasources';
                break;
            case TestDataQueryType.StreamingClient:
                update.stream = defaultStreamQuery;
                break;
            case TestDataQueryType.Live:
                update.channel = 'random-2s-stream'; // default stream
                break;
            case TestDataQueryType.Simulation:
                update.sim = { key: { type: 'flight', tick: 10 } }; // default stream
                break;
            case TestDataQueryType.PredictablePulse:
                update.pulseWave = defaultPulseQuery;
                break;
            case TestDataQueryType.PredictableCSVWave:
                update.csvWave = defaultCSVWaveQuery;
                break;
            case TestDataQueryType.Annotations:
                update.lines = 10;
                break;
            case TestDataQueryType.USA:
                update.usa = {
                    mode: usaQueryModes[0].value,
                };
        }
        onUpdate(update);
    };
    const onInputChange = (e) => {
        const { name, value, type } = e.currentTarget;
        let newValue = value;
        if (type === 'number') {
            newValue = Number(value);
        }
        if (name === 'levelColumn' && e.currentTarget instanceof HTMLInputElement) {
            newValue = e.currentTarget.checked;
        }
        onUpdate(Object.assign(Object.assign({}, query), { [name]: newValue }));
    };
    const onFieldChange = (field) => (e) => {
        const { name, value, type } = e.target;
        let newValue = value;
        if (type === 'number') {
            newValue = Number(value);
        }
        onUpdate(Object.assign(Object.assign({}, query), { [field]: Object.assign(Object.assign({}, query[field]), { [name]: newValue }) }));
    };
    const onEndPointChange = ({ value }) => {
        onUpdate(Object.assign(Object.assign({}, query), { stringInput: value }));
    };
    const onStreamClientChange = onFieldChange('stream');
    const onPulseWaveChange = onFieldChange('pulseWave');
    const onUSAStatsChange = (usa) => {
        onUpdate(Object.assign(Object.assign({}, query), { usa }));
    };
    const onCSVWaveChange = (csvWave) => {
        onUpdate(Object.assign(Object.assign({}, query), { csvWave }));
    };
    const options = useMemo(() => (scenarioList || [])
        .map((item) => ({ label: item.name, value: item.id }))
        .sort((a, b) => a.label.localeCompare(b.label)), [scenarioList]);
    // Common options that can be added to various scenarios
    const show = useMemo(() => {
        var _a;
        const scenarioId = (_a = query.scenarioId) !== null && _a !== void 0 ? _a : '';
        return {
            labels: ['random_walk', 'predictable_pulse'].includes(scenarioId),
            dropPercent: ['csv_content', 'csv_file'].includes(scenarioId),
        };
    }, [query === null || query === void 0 ? void 0 : query.scenarioId]);
    if (loading) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, { "aria-label": selectors.scenarioSelectContainer },
            React.createElement(InlineField, { labelWidth: 14, label: "Scenario" },
                React.createElement(Select, { inputId: `test-data-scenario-select-${query.refId}`, options: options, value: options.find((item) => item.value === query.scenarioId), onChange: onScenarioChange, width: 32 })),
            (currentScenario === null || currentScenario === void 0 ? void 0 : currentScenario.stringInput) && (React.createElement(InlineField, { label: "String Input" },
                React.createElement(Input, { width: 32, id: `stringInput-${query.refId}`, name: "stringInput", placeholder: query.stringInput, value: query.stringInput, onChange: onInputChange }))),
            Boolean(!(currentScenario === null || currentScenario === void 0 ? void 0 : currentScenario.hideAliasField)) && (React.createElement(InlineField, { label: "Alias", labelWidth: 14 },
                React.createElement(Input, { width: 32, id: `alias-${query.refId}`, type: "text", placeholder: "optional", pattern: '[^<>&\\\\"]+', name: "alias", value: query.alias, onChange: onInputChange }))),
            show.dropPercent && (React.createElement(InlineField, { label: "Drop", tooltip: 'Drop a random set of points' },
                React.createElement(Input, { type: "number", min: 0, max: 100, step: 5, width: 8, onChange: onInputChange, name: "dropPercent", placeholder: "0", value: query.dropPercent, suffix: React.createElement(Icon, { name: "percentage" }) }))),
            show.labels && (React.createElement(InlineField, { label: "Labels", labelWidth: 14, tooltip: React.createElement(React.Fragment, null,
                    "Set labels using a key=value syntax:",
                    React.createElement("br", null),
                    `{ key = "value", key2 = "value" }`,
                    React.createElement("br", null),
                    "key=\"value\", key2=\"value\"",
                    React.createElement("br", null),
                    "key=value, key2=value",
                    React.createElement("br", null),
                    "Value can contain templates:",
                    React.createElement("br", null),
                    "$seriesIndex - replaced with index of the series") },
                React.createElement(Input, { width: 32, id: `labels-${query.refId}`, name: "labels", onChange: onInputChange, value: query === null || query === void 0 ? void 0 : query.labels, placeholder: "key=value, key2=value2" })))),
        scenarioId === TestDataQueryType.RandomWalk && (React.createElement(RandomWalkEditor, { onChange: onInputChange, query: query, ds: datasource })),
        scenarioId === TestDataQueryType.StreamingClient && (React.createElement(StreamingClientEditor, { onChange: onStreamClientChange, query: query, ds: datasource })),
        scenarioId === TestDataQueryType.Live && React.createElement(GrafanaLiveEditor, { onChange: onUpdate, query: query, ds: datasource }),
        scenarioId === TestDataQueryType.Simulation && (React.createElement(SimulationQueryEditor, { onChange: onUpdate, query: query, ds: datasource })),
        scenarioId === TestDataQueryType.RawFrame && (React.createElement(RawFrameEditor, { onChange: onUpdate, query: query, ds: datasource })),
        scenarioId === TestDataQueryType.CSVFile && React.createElement(CSVFileEditor, { onChange: onUpdate, query: query, ds: datasource }),
        scenarioId === TestDataQueryType.CSVContent && (React.createElement(CSVContentEditor, { onChange: onUpdate, query: query, ds: datasource })),
        scenarioId === TestDataQueryType.Logs && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Lines", labelWidth: 14 },
                React.createElement(Input, { type: "number", name: "lines", value: query.lines, width: 32, onChange: onInputChange, placeholder: "10" })),
            React.createElement(InlineField, { label: "Level", labelWidth: 14 },
                React.createElement(InlineSwitch, { onChange: onInputChange, name: "levelColumn", value: !!query.levelColumn })))),
        scenarioId === TestDataQueryType.Annotations && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Count", labelWidth: 14 },
                React.createElement(Input, { type: "number", name: "lines", value: query.lines, width: 32, onChange: onInputChange, placeholder: "10" })))),
        scenarioId === TestDataQueryType.USA && React.createElement(USAQueryEditor, { onChange: onUSAStatsChange, query: (_a = query.usa) !== null && _a !== void 0 ? _a : {} }),
        scenarioId === TestDataQueryType.GrafanaAPI && (React.createElement(InlineField, { labelWidth: 14, label: "Endpoint" },
            React.createElement(Select, { options: endpoints, onChange: onEndPointChange, width: 32, value: endpoints.find((ep) => ep.value === query.stringInput) }))),
        scenarioId === TestDataQueryType.Arrow && (React.createElement(InlineField, { grow: true },
            React.createElement(TextArea, { name: "stringInput", value: query.stringInput, rows: 10, placeholder: "Copy base64 text data from query result", onChange: onInputChange }))),
        scenarioId === TestDataQueryType.FlameGraph && (React.createElement(InlineField, { label: 'Diff profile', grow: true },
            React.createElement(InlineSwitch, { value: Boolean(query.flamegraphDiff), onChange: (e) => {
                    onUpdate(Object.assign(Object.assign({}, query), { flamegraphDiff: e.currentTarget.checked }));
                } }))),
        scenarioId === TestDataQueryType.PredictablePulse && (React.createElement(PredictablePulseEditor, { onChange: onPulseWaveChange, query: query, ds: datasource })),
        scenarioId === TestDataQueryType.PredictableCSVWave && (React.createElement(CSVWavesEditor, { onChange: onCSVWaveChange, waves: query.csvWave })),
        scenarioId === TestDataQueryType.NodeGraph && (React.createElement(NodeGraphEditor, { onChange: (val) => onChange(Object.assign(Object.assign({}, query), { nodes: val })), query: query })),
        scenarioId === TestDataQueryType.ServerError500 && (React.createElement(ErrorEditor, { onChange: onUpdate, query: query, ds: datasource })),
        scenarioId === TestDataQueryType.Trace && (React.createElement(InlineField, { labelWidth: 14, label: "Span count" },
            React.createElement(Input, { type: "number", name: "spanCount", value: query.spanCount, width: 32, onChange: onInputChange, placeholder: "10" }))),
        description && React.createElement("p", null, description)));
};
//# sourceMappingURL=QueryEditor.js.map