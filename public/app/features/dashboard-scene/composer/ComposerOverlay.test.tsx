import { act, fireEvent, render, screen } from '@testing-library/react';

import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import { ComposerOverlay } from './ComposerOverlay';
import { ComposerSession } from './ComposerSession';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

let deactivate = () => {};
const originalElementsFromPoint = document.elementsFromPoint;

beforeEach(() => {
  setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true, 'grafana.dashboardComposer': true });
  locationService.replace('/d/overlay-test');
});

afterEach(() => {
  deactivate();
  deactivate = () => {};
  document.elementsFromPoint = originalElementsFromPoint;
  setTestFlags({});
});

function setup() {
  const scene = transformSaveModelToScene({
    dashboard: {
      title: 'Overlay',
      uid: 'overlay-test',
      version: 1,
      schemaVersion: 39,
      panels: [{ id: 3, type: 'text', title: 'Latency', gridPos: { x: 0, y: 0, w: 12, h: 8 } }],
      annotations: {
        list: [
          {
            builtIn: 1,
            iconColor: 'rgba(0, 211, 255, 1)',
            enable: false,
            hide: true,
            name: 'Annotations & Alerts',
            type: 'dashboard',
            datasource: { uid: '-- Grafana --', type: 'grafana' },
          },
        ],
      },
    },
    meta: { canEdit: true, canSave: true },
  });
  deactivate = scene.activate();
  const session = ComposerSession.enter(scene);

  // A stand-in for the rendered VizPanel root under the pointer.
  const panelRoot = document.createElement('div');
  panelRoot.setAttribute('data-viz-panel-key', 'panel-3');
  const panelContent = document.createElement('span');
  panelRoot.appendChild(panelContent);
  document.body.appendChild(panelRoot);
  document.elementsFromPoint = () => [screen.getByTestId('dashboard-composer-overlay'), panelContent];

  render(<ComposerOverlay session={session} />);
  const startPick = () => {
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickElement(new AbortController().signal);
    });
    return pick;
  };
  return { startPick, panelRoot };
}

it('resolves a click on a panel to its panel id while picking', async () => {
  const { startPick, panelRoot } = setup();
  const pick = startPick();
  const overlay = screen.getByTestId('dashboard-composer-overlay');

  fireEvent.pointerMove(overlay, { clientX: 10, clientY: 10 });
  fireEvent.click(overlay, { clientX: 10, clientY: 10 });

  await expect(pick).resolves.toEqual({ ref: { kind: 'panel', panelId: 3 }, label: 'Latency', tabPath: [] });
  panelRoot.remove();
});

it('cancels the pick on Escape', async () => {
  const { startPick, panelRoot } = setup();
  const pick = startPick();

  fireEvent.keyDown(window, { key: 'Escape' });

  await expect(pick).resolves.toBeNull();
  panelRoot.remove();
});
