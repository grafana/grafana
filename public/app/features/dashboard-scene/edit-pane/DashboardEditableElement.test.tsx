import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { config } from '@grafana/runtime';

import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardEditPane } from './DashboardEditPane';
import { DashboardDescriptionInput, DashboardTitleInput } from './DashboardEditableElement';

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneUtils: {
    ...jest.requireActual('@grafana/scenes').sceneUtils,
    registerVariableMacro: jest.fn(),
  },
}));

describe('DashboardEditableElement', () => {
  describe('DashboardTitleInput', () => {
    it('Supports undo/redo', async () => {
      const { renderTitleInput, dashboard } = setup();

      renderTitleInput();
      const titleInput = screen.getByRole('textbox');
      await testDashboardEditableElement(dashboard, titleInput);
    });
  });

  describe('DashboardDescriptionInput', () => {
    it('Supports undo/redo', async () => {
      const { renderDescriptionInput, dashboard } = setup();

      renderDescriptionInput();
      const descriptionTextarea = screen.getByRole('textbox');
      await testDashboardEditableElement(dashboard, descriptionTextarea);
    });
  });
});

async function testDashboardEditableElement(dashboard: DashboardScene, inputElement: HTMLElement) {
  const updateInput = async (newValue: string) => {
    fireEvent.focus(inputElement);
    await userEvent.clear(inputElement);
    await userEvent.type(inputElement, newValue);
    fireEvent.blur(inputElement);
  };

  const editPane = dashboard.state.editPane;
  expect(editPane.state.undoStack).toHaveLength(0);
  expect(editPane.state.redoStack).toHaveLength(0);
  expect(inputElement).toHaveValue('initial');

  await updateInput('first');
  expect(inputElement).toHaveValue('first');
  expect(editPane.state.undoStack).toHaveLength(1);
  expect(editPane.state.redoStack).toHaveLength(0);

  undo(editPane);
  expect(inputElement).toHaveValue('initial');
  expect(editPane.state.undoStack).toHaveLength(0);
  expect(editPane.state.redoStack).toHaveLength(1);

  await updateInput('second');
  expect(inputElement).toHaveValue('second');
  expect(editPane.state.redoStack).toHaveLength(0);
  expect(editPane.state.undoStack).toHaveLength(1);

  await updateInput('third');
  expect(inputElement).toHaveValue('third');
  expect(editPane.state.redoStack).toHaveLength(0);
  expect(editPane.state.undoStack).toHaveLength(2);

  await updateInput('fourth');
  expect(inputElement).toHaveValue('fourth');
  expect(editPane.state.redoStack).toHaveLength(0);
  expect(editPane.state.undoStack).toHaveLength(3);

  undo(editPane);
  expect(inputElement).toHaveValue('third');
  expect(editPane.state.redoStack).toHaveLength(1);
  expect(editPane.state.undoStack).toHaveLength(2);

  undo(editPane);
  expect(inputElement).toHaveValue('second');
  expect(editPane.state.redoStack).toHaveLength(2);
  expect(editPane.state.undoStack).toHaveLength(1);

  redo(editPane);
  expect(inputElement).toHaveValue('third');
  expect(editPane.state.redoStack).toHaveLength(1);
  expect(editPane.state.undoStack).toHaveLength(2);
}

function setup(overrides?: Partial<DashboardSceneState>) {
  const dashboard = transformSaveModelToScene({
    dashboard: {
      title: 'initial',
      description: 'initial',
      uid: 'my-uid',
      schemaVersion: 30,
      panels: [],
      version: 10,
    },
    meta: {},
    ...overrides,
  });

  // Clear any data layers
  dashboard.setState({ $data: undefined });

  config.featureToggles.dashboardNewLayouts = true;
  activateFullSceneTree(dashboard);

  dashboard.onEnterEditMode();

  const renderTitleInput = () => {
    render(
      <TestProvider>
        <DashboardTitleInput dashboard={dashboard} />
      </TestProvider>
    );
  };

  const renderDescriptionInput = () => {
    render(
      <TestProvider>
        <DashboardDescriptionInput dashboard={dashboard} />
      </TestProvider>
    );
  };

  return { dashboard, renderTitleInput, renderDescriptionInput };
}

function undo(editPane: DashboardEditPane) {
  act(() => {
    editPane.undoAction();
  });
}

function redo(editPane: DashboardEditPane) {
  act(() => {
    editPane.redoAction();
  });
}
