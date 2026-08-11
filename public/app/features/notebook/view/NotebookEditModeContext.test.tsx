import { act, getWrapper, renderHook } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { NotebookEditModeProvider, useNotebookEditMode } from './NotebookEditModeContext';

function setup({ canEdit, initialUrl }: { canEdit: boolean; initialUrl: string }) {
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(canEdit);

  // getWrapper owns the router and the location service; the provider goes inside it so that
  // useSearchParams reads the url we asked for.
  // renderWithRouter is explicit: getWrapper leaves it undefined, and only customRender defaults it
  // on, so without this the wrapper is a Fragment and useSearchParams has no router to read.
  const Wrapper = getWrapper({ renderWithRouter: true, historyOptions: { initialEntries: [initialUrl] } });

  return renderHook(() => useNotebookEditMode(), {
    wrapper: ({ children }) => (
      <Wrapper>
        <NotebookEditModeProvider>{children}</NotebookEditModeProvider>
      </Wrapper>
    ),
  });
}

describe('NotebookEditModeProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts in view mode by default', () => {
    const { result } = setup({ canEdit: true, initialUrl: '/notebooks/nb1' });

    expect(result.current.isEditing).toBe(false);
    expect(result.current.canEdit).toBe(true);
  });

  it('starts in edit mode when the url says so', () => {
    const { result } = setup({ canEdit: true, initialUrl: '/notebooks/nb1?edit=true' });

    expect(result.current.isEditing).toBe(true);
  });

  it('ignores the url for a user without edit permission', () => {
    // Otherwise anyone could hand-type their way into edit mode.
    const { result } = setup({ canEdit: false, initialUrl: '/notebooks/nb1?edit=true' });

    expect(result.current.isEditing).toBe(false);
    expect(result.current.canEdit).toBe(false);
  });

  it('treats an explicit edit=false as view mode', () => {
    const { result } = setup({ canEdit: true, initialUrl: '/notebooks/nb1?edit=false' });

    expect(result.current.isEditing).toBe(false);
  });

  it('refuses to enter edit mode without permission', () => {
    const { result } = setup({ canEdit: false, initialUrl: '/notebooks/nb1' });

    act(() => {
      result.current.setIsEditing(true);
    });

    expect(result.current.isEditing).toBe(false);
  });

  it('puts the mode in the url, so a reload or a copied link keeps it', () => {
    const { result } = setup({ canEdit: true, initialUrl: '/notebooks/nb1' });

    act(() => {
      result.current.setIsEditing(true);
    });

    expect(result.current.isEditing).toBe(true);
    expect(locationService.getLocation().search).toContain('edit=true');
  });

  it('drops the param again when leaving edit mode', () => {
    const { result } = setup({ canEdit: true, initialUrl: '/notebooks/nb1?edit=true' });

    act(() => {
      result.current.setIsEditing(false);
    });

    expect(result.current.isEditing).toBe(false);
    expect(locationService.getLocation().search).not.toContain('edit');
  });
});
