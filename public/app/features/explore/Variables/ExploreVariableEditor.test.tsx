import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable, SceneVariableSet } from '@grafana/scenes';

import { configureStore } from '../../../store/configureStore';
import { makeExplorePaneState } from '../state/utils';

import { ExploreVariableEditor } from './ExploreVariableEditor';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    reportInteraction: jest.fn(),
    getDataSourceSrv: () => ({
      getInstanceSettings: () => ({
        name: 'default',
        uid: 'default',
        type: 'prometheus',
        meta: { builtIn: false, id: 'prometheus', name: 'Prometheus', info: { logos: { small: '', large: '' } } },
      }),
      getList: () => [],
      get: () => Promise.resolve({}),
    }),
  };
});

function createStoreWithPane(variableSet?: SceneVariableSet) {
  const store = configureStore();
  const paneState = makeExplorePaneState();
  if (variableSet) {
    paneState.variableSet = variableSet;
  }
  store.getState().explore.panes = { left: paneState };
  return store;
}

function renderEditor(props: {
  variableSet?: SceneVariableSet;
  initialView?: 'list' | 'editor';
  onClose?: () => void;
}) {
  const variableSet = props.variableSet ?? new SceneVariableSet({ variables: [] });
  const onClose = props.onClose ?? jest.fn();
  const store = createStoreWithPane(variableSet);

  return {
    onClose,
    ...render(
      <TestProvider store={store}>
        <ExploreVariableEditor
          exploreId="left"
          variableSet={variableSet}
          initialView={props.initialView}
          onClose={onClose}
        />
      </TestProvider>
    ),
  };
}

describe('ExploreVariableEditor', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when opened with no variables', () => {
    it('opens editor form directly for a new CustomVariable', async () => {
      renderEditor({});

      const editorForm = await screen.findByRole('form', { name: /variable editor form/i });
      expect(editorForm).toBeInTheDocument();
    });

    it('does not show type selection', () => {
      renderEditor({});

      expect(screen.queryByText('Query')).not.toBeInTheDocument();
      expect(screen.queryByText('Textbox')).not.toBeInTheDocument();
      expect(screen.queryByText('Constant')).not.toBeInTheDocument();
    });
  });

  describe('editor form', () => {
    it('renders VariableEditorForm for a CustomVariable', async () => {
      renderEditor({});

      const editorForm = await screen.findByRole('form', { name: /variable editor form/i });
      expect(editorForm).toBeInTheDocument();

      const nameInput = screen.getByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
      );
      expect(nameInput).toBeInTheDocument();
    });

    it('hides the variable type selector', async () => {
      renderEditor({});

      await screen.findByRole('form', { name: /variable editor form/i });

      expect(screen.queryByLabelText(/variable type/i)).not.toBeInTheDocument();
    });
  });

  describe('when opened with existing variables (list view)', () => {
    function setupWithVariables() {
      const customVar = new CustomVariable({ name: 'myvar', query: 'a,b,c' });
      const customVar2 = new CustomVariable({ name: 'othervar', query: 'x,y' });
      const variableSet = new SceneVariableSet({ variables: [customVar, customVar2] });
      return { customVar, customVar2, variableSet };
    }

    it('shows list view with existing variables', () => {
      const { variableSet } = setupWithVariables();
      renderEditor({ variableSet, initialView: 'list' });

      expect(screen.getByText('myvar')).toBeInTheDocument();
      expect(screen.getByText('othervar')).toBeInTheDocument();
    });

    it('opens editor form when clicking edit on a variable', async () => {
      const user = userEvent.setup();
      const { variableSet } = setupWithVariables();
      renderEditor({ variableSet, initialView: 'list' });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const editorForm = await screen.findByRole('form', { name: /variable editor form/i });
      expect(editorForm).toBeInTheDocument();
    });

    it('shows delete confirmation modal when clicking delete', async () => {
      const user = userEvent.setup();
      const { variableSet } = setupWithVariables();
      renderEditor({ variableSet, initialView: 'list' });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByText('Delete variable')).toBeInTheDocument();
    });

    it('opens editor form directly when clicking New variable', async () => {
      const user = userEvent.setup();
      const { variableSet } = setupWithVariables();
      renderEditor({ variableSet, initialView: 'list' });

      await user.click(screen.getByText('New variable'));

      const editorForm = await screen.findByRole('form', { name: /variable editor form/i });
      expect(editorForm).toBeInTheDocument();
    });
  });

  describe('empty list view', () => {
    it('opens editor form directly when no variables exist', async () => {
      const variableSet = new SceneVariableSet({ variables: [] });
      renderEditor({ variableSet });

      const editorForm = await screen.findByRole('form', { name: /variable editor form/i });
      expect(editorForm).toBeInTheDocument();
    });
  });

  describe('editor navigation', () => {
    it('goes back to list from editor via Back to list button', async () => {
      const user = userEvent.setup();
      const customVar = new CustomVariable({ name: 'myvar', query: 'a,b,c' });
      const variableSet = new SceneVariableSet({ variables: [customVar] });
      renderEditor({ variableSet, initialView: 'list' });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const backButton = await screen.findByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton
      );
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('myvar')).toBeInTheDocument();
      });
    });
  });

  describe('name validation', () => {
    it('shows error for names starting with __', async () => {
      const user = userEvent.setup();
      const variable = new CustomVariable({ name: 'custom0', query: '' });
      const variableSet = new SceneVariableSet({ variables: [variable] });
      renderEditor({ variableSet, initialView: 'list' });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const nameInput = await screen.findByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
      );

      await user.clear(nameInput);
      await user.type(nameInput, '__reserved');

      await waitFor(() => {
        expect(
          screen.getByText("Template names cannot begin with '__', that's reserved for Grafana's global variables")
        ).toBeInTheDocument();
      });
    });

    it('shows error for duplicate variable names', async () => {
      const user = userEvent.setup();
      const existingVar = new CustomVariable({ name: 'existing', query: 'a' });
      const newVar = new CustomVariable({ name: 'custom0', query: '' });
      const variableSet = new SceneVariableSet({ variables: [existingVar, newVar] });
      renderEditor({ variableSet, initialView: 'list' });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[1]);

      const nameInput = await screen.findByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
      );

      await user.clear(nameInput);
      await user.type(nameInput, 'existing');

      await waitFor(() => {
        expect(screen.getByText(/variable with the same name already exists/i)).toBeInTheDocument();
      });
    });
  });
});
