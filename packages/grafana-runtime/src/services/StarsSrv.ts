import { type Observable } from 'rxjs';

/** One object a user can star: its kind (`group`/`kind`) and its `metadata.name` (`id`). */
export interface StarredResourceRef {
  group: string;
  kind: string;
  id: string;
}

/**
 * Stars objects on behalf of the signed-in user and reads back what they have starred.
 *
 * App plugins get this through {@link getStarsSrv}. Stars of any kind are stored. Grafana shows
 * its own kinds (dashboards, folders), and the kinds of installed app plugins that it can link to
 * and whose API serves search, wherever starred dashboards appear; {@link StarsSrv.canStar} tells
 * which. Its Starred navigation and lists follow every change: stars through {@link StarsSrv.star}
 * and {@link StarsSrv.unstar}, and the objects themselves through {@link StarsSrv.resourceUpdated}
 * and {@link StarsSrv.resourceDeleted}, which code that saves or deletes an object of a starrable
 * kind outside Grafana's own views calls.
 */
export interface StarsSrv {
  /** Whether Grafana shows starred objects of the kind. Stars of other kinds are stored but not shown. */
  canStar(group: string, kind: string): Promise<boolean>;
  /** Stars the object for the signed-in user. Rejects when Grafana refuses (e.g. not signed in, server error). Grafana's Starred navigation and lists update on success. */
  star(ref: StarredResourceRef): Promise<void>;
  /** Unstars the object for the signed-in user. Rejects when Grafana refuses (e.g. not signed in, server error). Grafana's Starred navigation and lists update on success. */
  unstar(ref: StarredResourceRef): Promise<void>;
  /** Names (`metadata.name`) of the user's starred objects of a kind. Emits the current set on subscribe and again whenever it changes, including changes made elsewhere in Grafana. Never errors: a set Grafana cannot read is emitted as empty, and the real set follows once a read succeeds. */
  starred(group: string, kind: string): Observable<string[]>;
  /** Tells Grafana the object was saved, so a starred one is searched again and listed under its saved title. */
  resourceUpdated(ref: StarredResourceRef): void;
  /** Tells Grafana the object is gone, so a starred one is searched again and leaves the Starred lists. Its star stays stored. */
  resourceDeleted(ref: StarredResourceRef): void;
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
