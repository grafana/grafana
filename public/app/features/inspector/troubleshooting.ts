import { cloneDeep } from 'lodash';
import { firstValueFrom } from 'rxjs';

import { dateTime, dateTimeFormat } from '@grafana/data';
import { config } from '@grafana/runtime';

import { PanelModel } from '../dashboard/state';

import { getPanelDataFrames } from './InspectJSONTab';

export async function getTroubleshootingDashboard(panel: PanelModel) {
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

  const html = `<table width="100%">
    <tr>
        <th width="2%">Panel</th>
        <td >${info.panelType} @ ${saveModel.pluginVersion}</td>
    </tr>
    <tr>
        <th>Datasource</th>
        <td>prometheus @ XYZ</td>
    </tr>
    <tr>
        <th>Queries</th>
        <td>${saveModel.targets?.length}</td>
    </tr>
    <tr>
        <th>Transforms</th>
        <td>${saveModel.transformations?.length}</td>
    </tr>
    <tr>
        <th>Time range</th>
        <td>
        <a href="?from=a">Panel</a>,
        <a href="?from=b">Data</a>
        </td>
    </tr>
    <tr>
        <th>Grafana</th>
        <td>${config.buildInfo.version} // ${config.buildInfo.edition} // ${config.buildInfo.commit}</td>
    </tr>
    </table>`;

  // Replace the panel with embedded data
  dashboard.panels[0] = {
    ...saveModel,
    ...dashboard.panels[0],
    targets: [
      {
        refId: 'A',
        datasource: {
          type: 'testdata',
          uid: 'nVPrVUQGk',
        },
        rawFrameContent: JSON.stringify(getPanelDataFrames(data)),
        scenarioId: 'raw_frame',
      },
    ],
  };
  dashboard.panels[1].options.content = html;
  dashboard.panels[2].options.content = `<pre>${JSON.stringify(saveModel, null, 2)}</pre>`;
  dashboard.title = `Troubleshooting: ${saveModel.title} // ${dateTimeFormat(new Date())}`;
  dashboard.tags = ['debug', info.panelType];
  dashboard.time = {
    from: dateTime(1655837890279).toISOString(),
    to: dateTime(1655838364279).toISOString(),
  };

  return dashboard;
}

const embeddedDataTemplate: any = {
  // should be dashboard model when that is accurate enough
  panels: [
    {
      id: 2,
      title: 'Reproduced with embedded data',
      datasource: {
        type: 'testdata',
        uid: 'nVPrVUQGk',
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
        content: 'enter HTLM here',
        mode: 'html',
      },
      title: 'Troubleshooting info',
      type: 'text',
    },
    {
      gridPos: {
        h: 13,
        w: 9,
        x: 15,
        y: 7,
      },
      id: 6,
      options: {
        content: 'enter HTLM here',
        mode: 'html',
      },
      title: 'Original Panel JSON',
      type: 'text',
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
};
