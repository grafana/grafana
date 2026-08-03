import { loadNotebookEditorPage, loadNotebookScenePage } from './routes';

jest.mock('../features/notebook/pages/NotebookScenePage', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../features/notebook/pages/NotebookEditorPage', () => ({
  __esModule: true,
  NotebookEditorPage: () => null,
}));

describe('notebook route loaders', () => {
  it('resolves notebook page modules', async () => {
    await expect(loadNotebookScenePage()).resolves.toEqual(expect.objectContaining({ default: expect.any(Function) }));
    await expect(loadNotebookEditorPage()).resolves.toEqual(
      expect.objectContaining({ NotebookEditorPage: expect.any(Function) })
    );
  });
});
