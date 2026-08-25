import { render, screen } from 'test/test-utils';

import { type Variable, type VariableSpec } from 'app/api/clients/dashboard/v2beta1';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { VariableEditorView } from './VariableEditorView';

jest.mock('app/core/components/Select/FolderPicker', () => ({
  FolderPicker: () => <div data-testid="folder-picker" />,
}));

jest.mock('app/features/dashboard-scene/settings/variables/VariableEditorForm', () => ({
  VariableEditorForm: () => <div data-testid="variable-editor-form" />,
}));

jest.mock('app/api/clients/folder/v1beta1/hooks', () => ({
  useGetFolderQueryFacade: (uid?: string) => ({
    data: uid ? { uid, canEdit: true } : undefined,
  }),
}));

jest.mock('./useVariableNameCollisionCheck', () => ({
  useVariableNameCollisionCheck: () => ({ isChecking: false, collisionError: undefined }),
}));

jest.mock('./useCanManageGlobalVariables', () => ({
  useCanManageGlobalVariables: () => false,
}));

const folderVariable: Variable = {
  metadata: {
    name: 'env--folder-a',
    annotations: { [AnnoKeyFolder]: 'folder-a' },
  },
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  spec: {
    kind: 'CustomVariable',
    spec: { name: 'env', query: 'dev,prod' },
  } as unknown as VariableSpec,
};

describe('VariableEditorView delete action', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enables Delete when the user has variables:delete and can edit the source folder', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    render(<VariableEditorView source={folderVariable} onBack={jest.fn()} />);

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('disables Delete when the user can write but lacks variables:delete', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action !== AccessControlAction.VariablesDelete);

    render(<VariableEditorView source={folderVariable} onBack={jest.fn()} />);

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
