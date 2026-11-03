import { act } from 'react';
import { render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { SaveDashboard } from '../scene/new-toolbar/actions/SaveDashboard';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import { ComposerSession } from './ComposerSession';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

let deactivate = () => {};

beforeEach(() => {
  setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true, 'grafana.dashboardComposer': true });
  locationService.replace('/d/paused-test');
});

afterEach(() => {
  deactivate();
  deactivate = () => {};
  setTestFlags({});
});

function setup() {
  const scene = transformSaveModelToScene({
    dashboard: {
      title: 'Paused',
      uid: 'paused-test',
      version: 1,
      schemaVersion: 39,
      panels: [],
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
  act(() => scene.setState({ isDirty: true }));
  render(<SaveDashboard dashboard={scene} />);
  return { session };
}

const saveButton = () => screen.getByTestId(selectors.components.NavToolbar.editDashboard.saveButton);

it('keeps saving available while a turn pauses the session', () => {
  const { session } = setup();

  act(() => session.setPaused(true));

  // A Button with a tooltip disables through aria-disabled so the tooltip still shows.
  expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
});

it('disables only Discard in the save menu while paused, and re-enables it on resume', async () => {
  const { session } = setup();
  act(() => session.setPaused(true));
  const openMenu = () =>
    act(async () => screen.getByTestId(selectors.components.NavToolbar.editDashboard.moreSaveOptionsButton).click());
  const disabledItems = () =>
    screen
      .getAllByRole('menuitem')
      .filter((item) => item.hasAttribute('disabled'))
      .map((item) => item.textContent);

  await openMenu();
  expect(disabledItems()).toEqual([expect.stringMatching(/^Discard changes/)]);
  expect(screen.getByText('Wait for Assistant to finish editing')).toBeInTheDocument();

  act(() => session.setPaused(false));
  expect(disabledItems()).toEqual([]);
});
