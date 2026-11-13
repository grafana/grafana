import { act, render, screen, waitFor } from 'test/test-utils';

import { sceneGraph } from '@grafana/scenes';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Variable, type VariableSpec } from 'app/api/clients/dashboard/v2beta1';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { toControlSourceRef } from 'app/features/dashboard-scene/utils/predefinedVariableOrigin';
import { fetchPredefinedVariables } from 'app/features/dashboard-scene/utils/predefinedVariables';
import { AccessControlAction } from 'app/types/accessControl';

import { VariableEditorView } from './VariableEditorView';

jest.mock('app/core/components/Select/FolderPicker', () => ({
  FolderPicker: ({ onChange }: { onChange: (uid: string) => void }) => (
    <button data-testid="folder-picker" onClick={() => onChange('folder-b')}>
      Move to folder-b
    </button>
  ),
}));

jest.mock('app/features/dashboard-scene/settings/variables/VariableEditorForm', () => ({
  VariableEditorForm: () => <div data-testid="variable-editor-form" />,
}));

jest.mock('app/api/clients/folder/v1beta1/hooks', () => ({
  useGetCombinedFolderQuery: (uid?: string) => ({
    data: uid ? { uid, canEdit: true } : undefined,
  }),
}));

// The editor scene activates the datasource and query variables; resolving them isn't under test.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: () => [],
    get: () => new Promise(() => {}),
  }),
  getDataSourceInstance: () => new Promise(() => {}),
}));

jest.mock('app/features/dashboard-scene/utils/predefinedVariables', () => ({
  ...jest.requireActual('app/features/dashboard-scene/utils/predefinedVariables'),
  fetchPredefinedVariables: jest.fn(),
}));

const updateVariable = jest.fn();
jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  ...jest.requireActual('app/api/clients/dashboard/v2beta1'),
  useUpdateVariableMutation: () => [updateVariable, { isLoading: false }],
}));

jest.mock('./useVariableNameCollisionCheck', () => ({
  useVariableNameCollisionCheck: () => ({ isChecking: false, collisionError: undefined }),
}));

const customSpec = {
  kind: 'CustomVariable',
  spec: { name: 'env', query: 'dev,prod' },
} as unknown as VariableSpec;

const folderVariable: Variable = {
  metadata: {
    name: 'env--folder-a',
    annotations: { [AnnoKeyFolder]: 'folder-a' },
  },
  spec: customSpec,
};

const globalVariable: Variable = {
  metadata: { name: 'env' },
  spec: customSpec,
};

const globalFolderHelp =
  'Scope the variable to a folder, or choose the root Dashboards folder to make it global (available to all dashboards)';
const folderOnlyHelp = 'Scope the variable to a folder you can edit';

const fetchPredefinedVariablesMock = jest.mocked(fetchPredefinedVariables);

beforeEach(() => {
  fetchPredefinedVariablesMock.mockReset();
  fetchPredefinedVariablesMock.mockResolvedValue([]);
  updateVariable.mockReturnValue({ unwrap: () => Promise.resolve() });
});

describe('VariableEditorView delete action', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enables Delete when the user has variables:delete and can edit the source folder', async () => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    render(<VariableEditorView source={folderVariable} onBack={jest.fn()} />);

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('disables Delete when the user can write but lacks variables:delete', async () => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action !== AccessControlAction.VariablesDelete);

    render(<VariableEditorView source={folderVariable} onBack={jest.fn()} />);

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('keeps Save enabled for an in-place edit when the user cannot delete', async () => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action !== AccessControlAction.VariablesDelete);

    render(<VariableEditorView source={folderVariable} onBack={jest.fn()} />);

    expect(await screen.findByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});

describe('VariableEditorView unsupported variable', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the load error with a way back instead of the editor', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    const onBack = jest.fn();
    const groupByVariable: Variable = {
      metadata: { name: 'cluster' },
      spec: { kind: 'GroupByVariable', spec: { name: 'cluster' } } as unknown as VariableSpec,
    };

    const { user } = render(<VariableEditorView source={groupByVariable} onBack={onBack} />);

    expect(await screen.findByText('This variable cannot be edited')).toBeInTheDocument();
    expect(screen.getByText('Scenes: Unsupported variable type GroupByVariable')).toBeInTheDocument();
    expect(screen.queryByTestId('variable-editor-form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('VariableEditorView folder help', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('describes root when inspecting a global variable without root rights', async () => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    render(<VariableEditorView source={globalVariable} onBack={jest.fn()} />);

    expect(await screen.findByText(globalFolderHelp)).toBeInTheDocument();
    expect(screen.queryByText(folderOnlyHelp)).not.toBeInTheDocument();
  });

  it('does not mention root when inspecting a folder-scoped variable without root rights', async () => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    render(<VariableEditorView source={folderVariable} onBack={jest.fn()} />);

    expect(await screen.findByText(folderOnlyHelp)).toBeInTheDocument();
    expect(screen.queryByText(globalFolderHelp)).not.toBeInTheDocument();
  });
});

function predefined(kind: VariableKind['kind'], name: string): VariableKind {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    kind,
    spec: { name, pluginId: 'prometheus', query: 'a,b', origin: toControlSourceRef({ type: 'global' }) },
  } as unknown as VariableKind;
}

const queryVariable: Variable = {
  metadata: { name: 'labels' },
  spec: {
    kind: 'QueryVariable',
    spec: {
      name: 'labels',
      query: { kind: 'DataQuery', group: 'prometheus', version: 'v0', datasource: { name: '${ds}' }, spec: {} },
    },
  } as unknown as VariableSpec,
};

const folderQueryVariable: Variable = {
  ...queryVariable,
  metadata: { name: 'labels--folder-a', annotations: { [AnnoKeyFolder]: 'folder-a' } },
};

function getSceneContextVariableNames() {
  return sceneGraph.getVariables(window.__grafanaSceneContext).state.variables.map((v) => v.state.name);
}

function getSceneContextVariable(name: string) {
  return sceneGraph.getVariables(window.__grafanaSceneContext).state.variables.find((v) => v.state.name === name);
}

describe('VariableEditorView datasource variable references', () => {
  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes only datasource variables from the global scope to a global variable', async () => {
    fetchPredefinedVariablesMock.mockResolvedValue([
      predefined('DatasourceVariable', 'ds'),
      predefined('CustomVariable', 'env'),
    ]);

    render(<VariableEditorView source={queryVariable} onBack={jest.fn()} />);

    await screen.findByTestId('variable-editor-form');
    expect(fetchPredefinedVariablesMock).toHaveBeenCalledWith(undefined);
    expect(getSceneContextVariableNames()).toEqual(['ds', 'labels']);
  });

  it('limits a folder variable to the global scope and its own folder', async () => {
    render(<VariableEditorView source={folderQueryVariable} onBack={jest.fn()} />);

    await screen.findByTestId('variable-editor-form');
    expect(fetchPredefinedVariablesMock).toHaveBeenCalledWith('folder-a');
  });

  it('does not fetch datasource variables for a type that cannot reference one', async () => {
    render(<VariableEditorView source={folderVariable} onBack={jest.fn()} />);

    await screen.findByTestId('variable-editor-form');
    expect(fetchPredefinedVariablesMock).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('warns but allows Save when the referenced datasource variable is not available in the scope', async () => {
    fetchPredefinedVariablesMock.mockResolvedValue([]);

    render(<VariableEditorView source={queryVariable} onBack={jest.fn()} />);

    expect(
      await screen.findByText(
        "$ds isn't global or in this folder, so it only resolves on dashboards that define their own ds"
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('does not warn about the datasource reference when the fetch fails', async () => {
    fetchPredefinedVariablesMock.mockResolvedValue(null);

    render(<VariableEditorView source={queryVariable} onBack={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    expect(screen.queryByText(/isn't global or in this folder/)).not.toBeInTheDocument();
  });

  it('does not rebuild the datasource variables while the name is typed', async () => {
    fetchPredefinedVariablesMock.mockResolvedValue([predefined('DatasourceVariable', 'ds')]);
    render(<VariableEditorView source={queryVariable} onBack={jest.fn()} />);
    await screen.findByTestId('variable-editor-form');
    const dsBefore = getSceneContextVariable('ds');

    // The name field commits each keystroke straight to the scene variable.
    act(() => getSceneContextVariable('labels')!.setState({ name: 'labelsx' }));

    await waitFor(() => expect(getSceneContextVariableNames()).toEqual(['ds', 'labelsx']));
    // Compare identity as a boolean: printing two scene objects on failure crashes the jest worker.
    expect(getSceneContextVariable('ds') === dsBefore).toBe(true);
  });

  it("drops the previous folder's datasource variables while the new folder's list loads", async () => {
    let resolveFolderB: (variables: VariableKind[]) => void = () => {};
    fetchPredefinedVariablesMock.mockImplementation((folderUid) =>
      folderUid === 'folder-b'
        ? new Promise((resolve) => {
            resolveFolderB = resolve;
          })
        : Promise.resolve([predefined('DatasourceVariable', 'ds')])
    );
    const { user } = render(<VariableEditorView source={folderQueryVariable} onBack={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());

    await user.click(screen.getByTestId('folder-picker'));

    await waitFor(() => expect(getSceneContextVariableNames()).toEqual(['labels']));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    resolveFolderB([predefined('DatasourceVariable', 'ds')]);

    await waitFor(() => expect(getSceneContextVariableNames()).toEqual(['ds', 'labels']));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('does not load the stored copy of the datasource variable being edited', async () => {
    fetchPredefinedVariablesMock.mockResolvedValue([predefined('DatasourceVariable', 'ds')]);
    const datasourceVariable: Variable = {
      metadata: { name: 'ds' },
      spec: { kind: 'DatasourceVariable', spec: { name: 'ds', pluginId: 'prometheus' } } as unknown as VariableSpec,
    };

    render(<VariableEditorView source={datasourceVariable} onBack={jest.fn()} />);

    await screen.findByTestId('variable-editor-form');
    expect(getSceneContextVariableNames()).toEqual(['ds']);
  });

  it('restores the previous scene context on unmount', async () => {
    const previousContext = window.__grafanaSceneContext;
    const { unmount } = render(<VariableEditorView source={queryVariable} onBack={jest.fn()} />);
    await screen.findByTestId('variable-editor-form');

    unmount();

    expect(window.__grafanaSceneContext).toBe(previousContext);
  });

  it('saves the `${ds}` reference without persisting the referenced variable', async () => {
    fetchPredefinedVariablesMock.mockResolvedValue([predefined('DatasourceVariable', 'ds')]);
    const { user } = render(<VariableEditorView source={queryVariable} onBack={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateVariable).toHaveBeenCalledTimes(1));
    const { spec } = updateVariable.mock.calls[0][0].patch;
    expect(spec.kind).toBe('QueryVariable');
    expect(spec.spec.name).toBe('labels');
    expect(spec.spec.query.datasource).toEqual({ name: '${ds}' });
  });
});
