import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable, QueryVariable, SceneVariableSet } from '@grafana/scenes';

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
  initialVariable?: CustomVariable | QueryVariable | null;
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
          initialVariable={props.initialVariable ?? undefined}
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
    it('shows type selection view', () => {
      renderEditor({});

      expect(screen.getByText('Custom')).toBeInTheDocument();
      expect(screen.getByText('Query')).toBeInTheDocument();
      expect(screen.getByText('Textbox')).toBeInTheDocument();
      expect(screen.getByText('Constant')).toBeInTheDocument();
    });

    it('closes the Drawer when cancel is clicked', async () => {
      const user = userEvent.setup();
      const { onClose } = renderEditor({});

      await user.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('type selection', () => {
    it('transitions to editor form after selecting a type', async () => {
      const user = userEvent.setup();
      renderEditor({});

      await user.click(screen.getByText('Custom'));

      const editorForm = await screen.findByRole('form', { name: /variable editor form/i });
      expect(editorForm).toBeInTheDocument();
    });

    it('renders VariableEditorForm for a CustomVariable', async () => {
      const user = userEvent.setup();
      renderEditor({});

      await user.click(screen.getByText('Custom'));

      const editorForm = await screen.findByRole('form', { name: /variable editor form/i });
      expect(editorForm).toBeInTheDocument();

      const nameInput = screen.getByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
      );
      expect(nameInput).toBeInTheDocument();
    });

    it('renders VariableEditorForm for a QueryVariable', async () => {
      const queryVar = new QueryVariable({ name: 'query0' });
      const variableSet = new SceneVariableSet({ variables: [queryVar] });
      renderEditor({ variableSet, initialVariable: queryVar });

      const editorForm = await screen.findByRole('form', { name: /variable editor form/i });
      expect(editorForm).toBeInTheDocument();
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
      renderEditor({ variableSet });

      expect(screen.getByText('myvar')).toBeInTheDocument();
      expect(screen.getByText('othervar')).toBeInTheDocument();
    });

    it('shows variable type in list', () => {
      const { variableSet } = setupWithVariables();
      renderEditor({ variableSet });

      expect(screen.getAllByText('custom').length).toBeGreaterThanOrEqual(2);
    });

    it('opens editor form when clicking edit on a variable', async () => {
      const user = userEvent.setup();
      const { variableSet } = setupWithVariables();
      renderEditor({ variableSet });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const editorForm = await screen.findByRole('form', { name: /variable editor form/i });
      expect(editorForm).toBeInTheDocument();
    });

    it('shows delete confirmation modal when clicking delete', async () => {
      const user = userEvent.setup();
      const { variableSet } = setupWithVariables();
      renderEditor({ variableSet });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByText('Delete variable')).toBeInTheDocument();
    });

    it('opens type selection when clicking New variable', async () => {
      const user = userEvent.setup();
      const { variableSet } = setupWithVariables();
      renderEditor({ variableSet });

      await user.click(screen.getByText('New variable'));

      expect(screen.getByText('Custom')).toBeInTheDocument();
      expect(screen.getByText('Query')).toBeInTheDocument();
    });
  });

  describe('when opened with an initialVariable', () => {
    it('shows editor form directly', () => {
      const variable = new CustomVariable({ name: 'editme', query: 'x,y' });
      const variableSet = new SceneVariableSet({ variables: [variable] });
      renderEditor({ variableSet, initialVariable: variable });

      const editorForm = screen.getByRole('form', { name: /variable editor form/i });
      expect(editorForm).toBeInTheDocument();
    });
  });

  describe('empty list view', () => {
    it('shows type selection when no variables exist', () => {
      const variableSet = new SceneVariableSet({ variables: [] });
      renderEditor({ variableSet });

      expect(screen.getByText('Custom')).toBeInTheDocument();
    });
  });

  describe('editor navigation', () => {
    it('goes back to list from editor via Back to list button', async () => {
      const user = userEvent.setup();
      const customVar = new CustomVariable({ name: 'myvar', query: 'a,b,c' });
      const variableSet = new SceneVariableSet({ variables: [customVar] });
      renderEditor({ variableSet, initialVariable: customVar });

      const backButton = screen.getByTestId(
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
      renderEditor({ variableSet, initialVariable: variable });

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
      renderEditor({ variableSet, initialVariable: newVar });

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
