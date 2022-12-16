// Libraries
import React, { useRef, useEffect } from 'react';
import { useAsync } from 'react-use';

import { config } from '@grafana/runtime';
import { Input } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { backendSrv } from 'app/core/services/backend_srv';
import { PanelModel } from 'app/features/dashboard/state';
import { Scene, SceneGridLayout, VizPanel } from 'app/features/scenes/components';
import { EmbeddedScene } from 'app/features/scenes/components/Scene';
import { SceneTimeRange } from 'app/features/scenes/core/SceneTimeRange';
import { SceneQueryRunner } from 'app/features/scenes/querying/SceneQueryRunner';
import { getQueryRunnerWithRandomWalkQuery } from 'app/features/scenes/scenes/queries';
import { TextMode } from 'app/plugins/panel/text/models.gen';
import { DashboardDTO } from 'app/types';

import { DashboardQueryResult, getGrafanaSearcher } from '../service';
import { getSearchStateManager } from '../state/SearchStateManager';

export interface Props extends GrafanaRouteComponentProps {}

export default function PanelSearchPage(props: Props) {
  const stateManager = getSearchStateManager();
  const state = stateManager.useState();
  const searcher = useRef(new PanelModelSearcher());
  useEffect(() => stateManager.initStateFromUrl(), [stateManager]);

  const results = useAsync(() => {
    return searcher.current.search(state.query ?? '*');
  }, [state.query]);

  return (
    <Page navId="scenes" subTitle="Search for panels">
      <Page.Contents>
        <Input
          placeholder={'Search for panels'}
          value={state.query ?? ''}
          onChange={(e) => stateManager.onQueryChange(e.currentTarget.value)}
          spellCheck={false}
          loading={results.loading}
        />

        {results.value && (
          <div>
            <div>
              <br />1 - {results.value?.panels.length} of {results.value?.totalRows}
              <br />
            </div>

            <results.value.scene.Component model={results.value.scene} />
          </div>
        )}
      </Page.Contents>
    </Page>
  );
}

interface PanelSearchResults {
  totalRows: number;
  panels: PanelModel[];
  scene: Scene;
}

class PanelModelSearcher {
  private counter = 0;
  private dashboards = new Map<string, DashboardDTO>();

  async search(query: string): Promise<PanelSearchResults> {
    const searcher = getGrafanaSearcher();
    const panelResults = await searcher.search({
      query,
      kind: ['panel'],
      limit: 12,
    });

    const panels: PanelModel[] = [];
    for (let i = 0; i < panelResults.view.length; i++) {
      const p = panelResults.view.get(i);
      const panel = await this.findPanel(p);
      panels.push(panel);
    }
    return {
      totalRows: panelResults.totalRows,
      panels,
      scene: panelsToScene(panels),
    };
  }

  async getDashboard(uid: string): Promise<DashboardDTO> {
    let dash = this.dashboards.get(uid);
    if (dash) {
      return Promise.resolve(dash);
    }
    dash = await backendSrv.getDashboardByUid(uid);
    dash.meta.canEdit = false; // avoids popup
    dash.meta.canSave = false; // avoids popup
    dash.meta.fromScript = true; // avoids popup
    this.dashboards.set(uid, dash);
    return dash;
  }

  async findPanel(p: DashboardQueryResult): Promise<PanelModel> {
    if (!config.panels[p.panel_type]) {
      return this.getErrorPanel('Unknown panel type ' + p.panel_type, p);
    }

    const idx = p.uid.indexOf('#');
    if (idx < 2) {
      return this.getErrorPanel('expected # in the UID', p);
    }

    const dashuid = p.uid.substring(0, idx);
    const panelid = parseInt(p.uid.substring(idx + 1), 10);
    const dash = await this.getDashboard(dashuid);
    const found = dash?.dashboard?.panels?.find((p) => p.id === panelid);
    if (!found) {
      return this.getErrorPanel('Unable to find: ' + p.uid, p);
    }

    const links = [
      {
        title: 'Dashboard',
        url: p.url,
      },
    ];

    if (found.links && Array.isArray(found.links)) {
      for (const v of found.links) {
        links.push(v);
      }
    }

    return {
      ...found,
      id: this.counter++,
      key: p.uid,
      links,
    };
  }

  getErrorPanel(err: string, p: DashboardQueryResult): PanelModel {
    const v = {
      id: this.counter++,
      key: p.uid,
      title: `ERROR: ${p.name}`,
      type: 'text',
      options: {
        content: `ERROR:  ${err}`,
        mode: TextMode.Markdown,
      },
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    };
    return v as unknown as PanelModel;
  }
}

export function panelsToScene(results: PanelModel[]): Scene {
  let x = 0;
  let panelW = 24 / 3; //8

  const state = {
    title: 'Search results',
    layout: new SceneGridLayout({
      children: results.map((panel, idx) => {
        if (idx > 0) {
          x += panelW;
        }
        if (x > 20) {
          x = 0;
        }
        return new VizPanel({
          isResizable: false,
          isDraggable: false,
          size: {
            x,
            y: 0,
            width: panelW,
            height: 8, // grid pos
            minHeight: '200px',
          },

          // Standard fields
          title: panel.title,
          pluginId: panel.type,
          options: panel.options,
          fieldConfig: panel.fieldConfig,
          pluginVersion: panel.pluginVersion,
          $data: panel.targets
            ? new SceneQueryRunner({
                queries: panel.targets,
              })
            : undefined,
        });
      }),
    }),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
  };

  return new EmbeddedScene(state);
}
