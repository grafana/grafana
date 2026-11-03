import { type IconName } from '@grafana/data';

/**
 * A resolved playlist item: where to navigate and what to call it.
 *
 * @alpha
 */
export interface PlaylistItemResolution {
  /** In-app URL to open while the item is playing. */
  url: string;
  title: string;
}

/**
 * One object a user can add to a playlist.
 *
 * @alpha
 */
export interface PlaylistItemSearchResult {
  /** Object name, as stored in the playlist item's `name` field. */
  name: string;
  title: string;
}

/**
 * Describes how a kind of App Platform object is found, named and opened by playlists.
 *
 * @alpha
 */
export interface PlaylistItemKind {
  group: string;
  resource: string;
  /** Label shown in the playlist editor's kind dropdown. */
  title: string;
  icon: IconName;
  /** Resolves a stored name. Returns undefined when the object is missing or the viewer cannot read it. */
  resolve: (name: string) => Promise<PlaylistItemResolution | undefined>;
  /** Lists objects matching the text, limited to what the viewer can list. */
  search: (query: string, limit: number) => Promise<PlaylistItemSearchResult[]>;
}

const kinds = new Map<string, PlaylistItemKind>();

const keyOf = (group: string, resource: string) => `${group}/${resource}`;

/**
 * Registers a kind of object that playlists can contain. Registering the same
 * group and resource again replaces the earlier registration.
 *
 * @alpha
 */
export function registerPlaylistItemKind(kind: PlaylistItemKind): void {
  const key = keyOf(kind.group, kind.resource);
  if (kinds.has(key)) {
    console.warn(`Playlist item kind ${key} is already registered, replacing it`);
  }
  kinds.set(key, kind);
}

/**
 * Returns all registered kinds in registration order.
 *
 * @alpha
 */
export function getPlaylistItemKinds(): PlaylistItemKind[] {
  return Array.from(kinds.values());
}

/**
 * Returns the kind registered for a group and resource, if any.
 *
 * @alpha
 */
export function getPlaylistItemKind(group: string, resource: string): PlaylistItemKind | undefined {
  return kinds.get(keyOf(group, resource));
}

/**
 * Clears the registry. Only meant for tests.
 *
 * @internal
 */
export function resetPlaylistItemKindsForTests(): void {
  kinds.clear();
}
