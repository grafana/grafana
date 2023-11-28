import { __awaiter } from "tslib";
import { cloneDeep } from 'lodash';
import { firstValueFrom } from 'rxjs';
import { dateTimeFormat, LoadingState, dataFrameToJSON, DataTopic, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { randomizeData } from './randomizer';
export function getPanelDataFrames(data) {
    var _a;
    const frames = [];
    if (data === null || data === void 0 ? void 0 : data.series) {
        for (const f of data.series) {
            frames.push(dataFrameToJSON(f));
        }
    }
    if (data === null || data === void 0 ? void 0 : data.annotations) {
        for (const f of data.annotations) {
            const json = dataFrameToJSON(f);
            if (!((_a = json.schema) === null || _a === void 0 ? void 0 : _a.meta)) {
                json.schema.meta = {};
            }
            json.schema.meta.dataTopic = DataTopic.Annotations;
            frames.push(json);
        }
    }
    return frames;
}
export function getGithubMarkdown(panel, snapshot) {
    var _a;
    const saveModel = panel.getSaveModel();
    const info = {
        panelType: saveModel.type,
        datasource: '??',
    };
    const grafanaVersion = `${config.buildInfo.version} (${config.buildInfo.commit})`;
    let md = `| Key | Value |
|--|--|
| Panel | ${info.panelType} @ ${(_a = saveModel.pluginVersion) !== null && _a !== void 0 ? _a : grafanaVersion} |
| Grafana | ${grafanaVersion} // ${config.buildInfo.edition} |
`;
    if (snapshot) {
        md += '<details><summary>Panel debug snapshot dashboard</summary>\n\n```json\n' + snapshot + '\n```\n</details>';
    }
    return md;
}
export function getDebugDashboard(panel, rand, timeRange) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const saveModel = panel.getSaveModel();
        const dashboard = cloneDeep(embeddedDataTemplate);
        const info = {
            panelType: saveModel.type,
            datasource: '??',
        };
        // reproducable
        const data = yield firstValueFrom(panel.getQueryRunner().getData({
            withFieldConfig: false,
            withTransforms: false,
        }));
        const dsref = panel.datasource;
        const frames = randomizeData(getPanelDataFrames(data), rand);
        const grafanaVersion = `${config.buildInfo.version} (${config.buildInfo.commit})`;
        const queries = (_a = saveModel === null || saveModel === void 0 ? void 0 : saveModel.targets) !== null && _a !== void 0 ? _a : [];
        const html = `<table width="100%">
    <tr>
      <th width="2%">Panel</th>
      <td >${info.panelType} @ ${(_b = saveModel.pluginVersion) !== null && _b !== void 0 ? _b : grafanaVersion}</td>
    </tr>
    <tr>
      <th>Queries</th>
      <td>${queries
            .map((t) => {
            var _a;
            const ds = (_a = t.datasource) !== null && _a !== void 0 ? _a : dsref;
            return `${t.refId}[${ds === null || ds === void 0 ? void 0 : ds.type}]`;
        })
            .join(', ')}</td>
    </tr>
    ${getTransformsRow(saveModel)}
    ${getDataRow(data, frames)}
    ${getAnnotationsRow(data)}
    <tr>
      <th>Grafana</th>
      <td>${grafanaVersion} // ${config.buildInfo.edition}</td>
    </tr>
  </table>`.trim();
        // Replace the panel with embedded data
        dashboard.panels[0] = Object.assign(Object.assign(Object.assign({}, saveModel), dashboard.panels[0]), { targets: [
                {
                    refId: 'A',
                    datasource: {
                        type: 'grafana',
                        uid: 'grafana',
                    },
                    queryType: GrafanaQueryType.Snapshot,
                    snapshot: frames,
                },
            ] });
        if ((_c = saveModel.transformations) === null || _c === void 0 ? void 0 : _c.length) {
            const last = dashboard.panels[dashboard.panels.length - 1];
            last.title = last.title + ' (after transformations)';
            const before = cloneDeep(last);
            before.id = 100;
            before.title = 'Data (before transformations)';
            before.gridPos.w = 24; // full width
            before.targets[0].withTransforms = false;
            dashboard.panels.push(before);
        }
        if ((_d = data.annotations) === null || _d === void 0 ? void 0 : _d.length) {
            dashboard.panels.push({
                id: 7,
                gridPos: {
                    h: 6,
                    w: 24,
                    x: 0,
                    y: 20,
                },
                type: 'table',
                title: 'Annotations',
                datasource: {
                    type: 'datasource',
                    uid: '-- Dashboard --',
                },
                options: {
                    showTypeIcons: true,
                },
                targets: [
                    {
                        datasource: {
                            type: 'datasource',
                            uid: '-- Dashboard --',
                        },
                        panelId: 2,
                        withTransforms: true,
                        topic: DataTopic.Annotations,
                        refId: 'A',
                    },
                ],
            });
        }
        dashboard.panels[1].options.content = html;
        dashboard.panels[2].options.content = JSON.stringify(saveModel, null, 2);
        dashboard.title = `Debug: ${saveModel.title} // ${dateTimeFormat(new Date())}`;
        dashboard.tags = ['debug', `debug-${info.panelType}`];
        dashboard.time = {
            from: timeRange.from.toISOString(),
            to: timeRange.to.toISOString(),
        };
        return dashboard;
    });
}
// eslint-disable-next-line
function getTransformsRow(saveModel) {
    if (!saveModel.transformations) {
        return '';
    }
    return `<tr>
      <th>Transform</th>
      <td>${saveModel.transformations.map((t) => t.id).join(', ')}</td>
  </tr>`;
}
function getDataRow(data, frames) {
    var _a;
    let frameCount = (_a = data.series.length) !== null && _a !== void 0 ? _a : 0;
    let fieldCount = 0;
    let rowCount = 0;
    for (const frame of data.series) {
        fieldCount += frame.fields.length;
        rowCount += frame.length;
    }
    return ('<tr>' +
        '<th>Data</th>' +
        '<td>' +
        `${data.state !== LoadingState.Done ? data.state : ''} ` +
        `${frameCount} frames, ${fieldCount} fields, ` +
        `${rowCount} rows ` +
        // `(${formattedValueToString(getValueFormat('decbytes')(raw?.length))} JSON)` +
        '</td>' +
        '</tr>');
}
function getAnnotationsRow(data) {
    var _a;
    if (!((_a = data.annotations) === null || _a === void 0 ? void 0 : _a.length)) {
        return '';
    }
    return `<tr>
  <th>Annotations</th>
  <td>${data.annotations.map((a, idx) => `<span>${a.length}</span>`)}</td>
</tr>`;
}
// eslint-disable-next-line
const embeddedDataTemplate = {
    // should be dashboard model when that is accurate enough
    panels: [
        {
            id: 2,
            title: 'Reproduced with embedded data',
            datasource: {
                type: 'grafana',
                uid: 'grafana',
            },
            gridPos: {
                h: 13,
                w: 15,
                x: 0,
                y: 0,
            },
        },
        {
            gridPos: {
                h: 7,
                w: 9,
                x: 15,
                y: 0,
            },
            id: 5,
            options: {
                content: '...',
                mode: 'html',
            },
            title: 'Debug info',
            type: 'text',
        },
        {
            id: 6,
            title: 'Original Panel JSON',
            type: 'text',
            gridPos: {
                h: 13,
                w: 9,
                x: 15,
                y: 7,
            },
            options: {
                content: '...',
                mode: 'code',
                code: {
                    language: 'json',
                    showLineNumbers: true,
                    showMiniMap: true,
                },
            },
        },
        {
            id: 3,
            title: 'Data from panel above',
            type: 'table',
            datasource: {
                type: 'datasource',
                uid: '-- Dashboard --',
            },
            gridPos: {
                h: 7,
                w: 15,
                x: 0,
                y: 13,
            },
            options: {
                showTypeIcons: true,
            },
            targets: [
                {
                    datasource: {
                        type: 'datasource',
                        uid: '-- Dashboard --',
                    },
                    panelId: 2,
                    withTransforms: true,
                    refId: 'A',
                },
            ],
        },
    ],
    schemaVersion: 37,
};
//# sourceMappingURL=utils.js.map