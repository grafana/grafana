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

it('disables saving while a turn pauses the session and re-enables it on resume and on exit', () => {
  const { session } = setup();
  // A Button with a tooltip disables through aria-disabled so the tooltip still shows.
  expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');

  act(() => session.setPaused(true));
  expect(saveButton()).toHaveAttribute('aria-disabled', 'true');

  act(() => session.setPaused(false));
  expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');

  act(() => session.setPaused(true));
  act(() => session.exit());
  expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
});

it('disables Save, Save as copy and Discard in the save menu while paused', async () => {
  const { session } = setup();
  act(() => session.setPaused(true));

  await act(async () =>
    screen.getByTestId(selectors.components.NavToolbar.editDashboard.moreSaveOptionsButton).click()
  );

  const items = screen.getAllByRole('menuitem');
  const disabled = items.filter((item) => item.hasAttribute('disabled')).map((item) => item.textContent);
  expect(disabled).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^Save(Wait|$)/),
      expect.stringMatching(/^Save as copy/),
      expect.stringMatching(/^Discard changes/),
    ])
  );
  // View changes stays available.
  expect(items.find((item) => item.textContent?.startsWith('View changes'))).not.toHaveAttribute('disabled');
  expect(screen.getAllByText('Wait for Assistant to finish editing').length).toBeGreaterThanOrEqual(3);
});
