import {
  getPlaylistItemKind,
  getPlaylistItemKinds,
  registerPlaylistItemKind,
  resetPlaylistItemKindsForTests,
  type PlaylistItemKind,
} from './playlistItemKinds';

function makeKind(overrides: Partial<PlaylistItemKind> = {}): PlaylistItemKind {
  return {
    group: 'things.example.app',
    resource: 'things',
    title: 'Things',
    icon: 'file-alt',
    resolve: async () => undefined,
    search: async () => [],
    ...overrides,
  };
}

describe('playlist item kind registry', () => {
  beforeEach(() => {
    resetPlaylistItemKindsForTests();
  });

  it('lists registered kinds and finds them by group and resource', () => {
    const kind = makeKind();
    registerPlaylistItemKind(kind);

    expect(getPlaylistItemKinds()).toEqual([kind]);
    expect(getPlaylistItemKind('things.example.app', 'things')).toBe(kind);
  });

  it('keeps registration order across kinds', () => {
    registerPlaylistItemKind(makeKind({ resource: 'a', title: 'A' }));
    registerPlaylistItemKind(makeKind({ resource: 'b', title: 'B' }));

    expect(getPlaylistItemKinds().map((k) => k.title)).toEqual(['A', 'B']);
  });

  it('replaces a kind registered twice and warns', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    registerPlaylistItemKind(makeKind({ title: 'First' }));
    registerPlaylistItemKind(makeKind({ title: 'Second' }));

    expect(getPlaylistItemKinds().map((k) => k.title)).toEqual(['Second']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('things.example.app/things'));
    warn.mockRestore();
  });

  it('returns nothing for an unregistered kind', () => {
    registerPlaylistItemKind(makeKind());

    expect(getPlaylistItemKind('other.example.app', 'things')).toBeUndefined();
    expect(getPlaylistItemKind('things.example.app', 'others')).toBeUndefined();
  });

  it('hands out a copy so callers cannot mutate the registry', () => {
    registerPlaylistItemKind(makeKind());
    getPlaylistItemKinds().pop();

    expect(getPlaylistItemKinds()).toHaveLength(1);
  });
});
