import { setDataSourceSrv, type DataSourceSrv } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import {
  defaultLibraryPanelKind,
  defaultPanelSpec,
  type LibraryPanelKind,
  type PanelKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { buildLibraryPanelState, buildVizPanelState } from '../serialization/layoutSerializers/utils';
import { buildGridItemForPanel } from '../serialization/transformSaveModelToScene';
import { getDefaultVizPanel } from '../utils/utils';

/**
 * Every site that builds a panel from a save model has to turn the rollout flag into VizPanel's
 * `applyPluginTransformations`, because that prop — not the flag — is what scenes reads. A site that
 * forgets it fails closed: the panel silently contributes nothing, which is invisible in every other
 * test in this suite. Hence one file that walks all of them.
 */
describe('applyPluginTransformations', () => {
  beforeAll(() => {
    // getDefaultVizPanel resolves the default datasource; nothing here depends on which one.
    setDataSourceSrv({ getInstanceSettings: () => undefined } as unknown as DataSourceSrv);
  });

  afterEach(() => {
    setTestFlags({});
  });

  function panelKind(): PanelKind {
    return { kind: 'Panel', spec: defaultPanelSpec() };
  }

  function libraryPanelKind(): LibraryPanelKind {
    return defaultLibraryPanelKind();
  }

  type PanelStateLike = { applyPluginTransformations?: boolean };
  // getDefaultVizPanel resolves the default datasource, so that one site alone is async.
  const sites: Array<[name: string, build: () => PanelStateLike | Promise<PanelStateLike>]> = [
    ['buildVizPanelState (v2 panel, and notebook, which calls it directly)', () => buildVizPanelState(panelKind(), 1)],
    ['buildLibraryPanelState (v2 library panel)', () => buildLibraryPanelState(libraryPanelKind(), 1)],
    ['buildGridItemForPanel (v1 dashboard)', () => buildGridItemForPanel(new PanelModel({ id: 1 })).state.body.state],
    ['getDefaultVizPanel (newly added panel)', async () => (await getDefaultVizPanel()).state],
  ];

  it.each(sites)('%s opts the panel in when the flag is on', async (_name, build) => {
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: true });

    expect((await build()).applyPluginTransformations).toBe(true);
  });

  it.each(sites)('%s leaves the panel out when the flag is off', async (_name, build) => {
    setTestFlags({ [FlagKeys.GrafanaPanelPluginTransformations]: false });

    expect((await build()).applyPluginTransformations).toBe(false);
  });
});
