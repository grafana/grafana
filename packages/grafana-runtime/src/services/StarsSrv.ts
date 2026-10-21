import { type Observable } from 'rxjs';

/** One object a user can star: which kind it is (`group`/`kind`), its `metadata.name` (`id`), and a title to show in Starred lists. */
export interface StarredResourceRef {
  group: string;
  kind: string;
  id: string;
  title: string;
}

/**
 * Stars objects on behalf of the signed-in user and reads back what they have starred.
 *
 * App plugins get this through {@link getStarsSrv}. It works for Grafana's own kinds
 * (dashboards, folders) and for any kind an installed app plugin declares in its
 * plugin.json `starredKinds`. Grafana keeps its Starred navigation and lists in sync as
 * stars change, so a plugin only has to call these methods.
 */
export interface StarsSrv {
  /** Whether this Grafana can star the kind: Grafana's own kinds, or one an installed app plugin declares in plugin.json `starredKinds`. */
  canStar(group: string, kind: string): Promise<boolean>;
  /** Stars the object for the signed-in user. Rejects when Grafana refuses (e.g. not signed in, kind unknown, server error). Grafana's Starred navigation and lists update on success. */
  star(ref: StarredResourceRef): Promise<void>;
  /** Unstars the object for the signed-in user. Rejects when Grafana refuses (e.g. not signed in, kind unknown, server error). Grafana's Starred navigation and lists update on success. */
  unstar(ref: StarredResourceRef): Promise<void>;
  /** Names (`metadata.name`) of the user's starred objects of a kind. Emits the current set on subscribe and again whenever it changes, including changes made elsewhere in Grafana. */
  starred(group: string, kind: string): Observable<string[]>;
}

let singletonInstance: StarsSrv | undefined;

/**
 * Used during startup by Grafana to set the StarsSrv so it is available
 * via the {@link getStarsSrv} to the rest of the application.
 *
 * @internal
 */
export const setStarsSrv = (instance: StarsSrv) => {
  singletonInstance = instance;
};

/**
 * Used to retrieve the {@link StarsSrv} that stars objects for the signed-in user
 * and reads back what they have starred.
 *
 * @public
 */
export const getStarsSrv = (): StarsSrv => {
  if (!singletonInstance) {
    throw new Error('StarsSrv not set. Use setStarsSrv to set it first.');
  }
  return singletonInstance;
};
