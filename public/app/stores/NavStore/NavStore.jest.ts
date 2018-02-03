import { NavStore } from './NavStore';

describe('NavStore', () => {
  const folderId = 1;
  const folderTitle = 'Folder Name';
  const folderUrl = '/dashboards/f/uid/folder-name';
  const canAdmin = true;

  const folder = {
    id: folderId,
    url: folderUrl,
    title: folderTitle,
    canAdmin: canAdmin,
  };

  let store;

  beforeEach(() => {
    store = NavStore.create();
    store.initFolderNav(folder, 'manage-folder-settings');
  });

  it('Should set text', () => {
    expect(store.main.text).toBe(folderTitle);
  });

  it('Should load nav with tabs', () => {
    expect(store.main.children.length).toBe(3);
    expect(store.main.children[0].id).toBe('manage-folder-dashboards');
    expect(store.main.children[1].id).toBe('manage-folder-permissions');
    expect(store.main.children[2].id).toBe('manage-folder-settings');
  });

  it('Should set correct urls for each tab', () => {
    expect(store.main.children.length).toBe(3);
    expect(store.main.children[0].url).toBe(folderUrl);
    expect(store.main.children[1].url).toBe(`${folderUrl}/permissions`);
    expect(store.main.children[2].url).toBe(`${folderUrl}/settings`);
  });

  it('Should set active tab', () => {
    expect(store.main.children.length).toBe(3);
    expect(store.main.children[0].active).toBe(false);
    expect(store.main.children[1].active).toBe(false);
    expect(store.main.children[2].active).toBe(true);
  });
});
