import { cloneDeep } from 'lodash';
import { firstValueFrom } from 'rxjs';

import {
  dateTimeFormat,
  TimeRange,
  DataQuery,
  PanelData,
  DataTransformerConfig,
  getValueFormat,
  formattedValueToString,
  DataFrameJSON,
  LoadingState,
  dataFrameToJSON,
  DataTopic,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { PanelModel } from 'app/features/dashboard/state';

import { Randomize, randomizeData } from './randomizer';

export function getPanelDataFrames(data?: PanelData): DataFrameJSON[] {
  const frames: DataFrameJSON[] = [];
  if (data?.series) {
    for (const f of data.series) {
      frames.push(dataFrameToJSON(f));
    }
  }
  if (data?.annotations) {
    for (const f of data.annotations) {
      const json = dataFrameToJSON(f);
      if (!json.schema?.meta) {
        json.schema!.meta = {};
      }
      json.schema!.meta.dataTopic = DataTopic.Annotations;
      frames.push(json);
    }
  }
  return frames;
}

export function getGithubMarkdown(panel: PanelModel, snapshot: string): string {
  const saveModel = panel.getSaveModel();
  const info = {
    panelType: saveModel.type,
    datasource: '??',
  };
  const grafanaVersion = `${config.buildInfo.version} (${config.buildInfo.commit})`;

  let md = `| Key | Value |
|--|--|
| Panel | ${info.panelType} @ ${saveModel.pluginVersion ?? grafanaVersion} |
| Grafana | ${grafanaVersion} // ${config.buildInfo.edition} |
`;

  if (snapshot) {
    md += '<details><summary>Panel debug snapshot dashboard</summary>\n\n```json\n' + snapshot + '\n```\n</details>';
  }
  return md;
}

export async function getDebugDashboard(panel: PanelModel, rand: Randomize, timeRange: TimeRange) {
  const saveModel = panel.getSaveModel();
  const dashboard = cloneDeep(embeddedDataTemplate);
  const info = {
    panelType: saveModel.type,
    datasource: '??',
  };

  // reproducable
  const data = await firstValueFrom(
    panel.getQueryRunner().getData({
      withFieldConfig: false,
      withTransforms: false,
    })
  );
  const frames = randomizeData(getPanelDataFrames(data), rand);
  const rawFrameContent = JSON.stringify(frames);
  const grafanaVersion = `${config.buildInfo.version} (${config.buildInfo.commit})`;
  const queries = saveModel?.targets ?? [];
  const html = `<table width="100%">
    <tr>
      <th width="2%">Panel</th>
      <td >${info.panelType} @ ${saveModel.pluginVersion ?? grafanaVersion}</td>
    </tr>
    <tr>
      <th>Queries&nbsp;(${queries.length})</th>
      <td>${queries
        .map((t: DataQuery) => {
          return `${t.refId}[${t.datasource?.type}]`;
        })
        .join(', ')}</td>
    </tr>
    ${getTransformsRow(saveModel)}
    ${getDataRow(data, rawFrameContent)}
    ${getAnnotationsRow(data)}
    <tr>
      <th>Grafana</th>
      <td>${grafanaVersion} // ${config.buildInfo.edition}</td>
    </tr>
  </table>`.trim();

  // Replace the panel with embedded data
  dashboard.panels[0] = {
    ...saveModel,
    ...dashboard.panels[0],
    targets: [
      {
        refId: 'A',
        datasource: {
          type: 'testdata',
          uid: '${testdata}',
        },
        rawFrameContent,
        scenarioId: 'raw_frame',
      },
    ],
  };

  if (data.annotations?.length) {
    const anno: DataFrameJSON[] = [];
    for (const f of frames) {
      if (f.schema?.meta?.dataTopic) {
        delete f.schema.meta.dataTopic;
        anno.push(f);
      }
    }

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
        type: 'testdata',
        uid: '${testdata}',
      },
      targets: [
        {
          refId: 'A',
          rawFrameContent: JSON.stringify(anno),
          scenarioId: 'raw_frame',
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
}

// eslint-disable-next-line
function getTransformsRow(saveModel: any): string {
  if (!saveModel.transformations) {
    return '';
  }
  return `<tr>
      <th>Transforms (${saveModel.transformations.length})</th>
      <td>${saveModel.transformations.map((t: DataTransformerConfig) => t.id).join(', ')}</td>
  </tr>`;
}

function getDataRow(data: PanelData, raw: string): string {
  let frameCount = data.series.length ?? 0;
  let fieldCount = 0;
  for (const frame of data.series) {
    fieldCount += frame.fields.length;
  }
  return (
    '<tr>' +
    '<th>Data</th>' +
    '<td>' +
    `${data.state !== LoadingState.Done ? data.state : ''} ` +
    `${frameCount} frames, ${fieldCount} fields` +
    `(${formattedValueToString(getValueFormat('decbytes')(raw?.length))} JSON)` +
    '</td>' +
    '</tr>'
  );
}

function getAnnotationsRow(data: PanelData): string {
  if (!data.annotations?.length) {
    return '';
  }

  return `<tr>
  <th>Annotations</th>
  <td>${data.annotations.map((a, idx) => `<span>${a.length}</span>`)}</td>
</tr>`;
}

// eslint-disable-next-line
const embeddedDataTemplate: any = {
  // should be dashboard model when that is accurate enough
  panels: [
    {
      id: 2,
      title: 'Reproduced with embedded data',
      datasource: {
        type: 'testdata',
        uid: '${testdata}',
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
      targets: [
        {
          datasource: {
            type: 'datasource',
            uid: '-- Dashboard --',
          },
          panelId: 2,
          refId: 'A',
        },
      ],
    },
  ],
  schemaVersion: 37,
  templating: {
    list: [
      {
        current: {
          selected: true,
          text: 'gdev-testdata',
          value: 'gdev-testdata',
        },
        hide: 0,
        includeAll: false,
        multi: false,
        name: 'testdata',
        options: [],
        query: 'testdata',
        skipUrlSync: false,
        type: 'datasource',
      },
    ],
  },
};
