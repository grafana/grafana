import { type Observable } from 'rxjs';

/** One object a user can star: its kind (`group`, `kind`) and its `metadata.name`. */
export interface StarredResourceRef {
  group: string;
  kind: string;
  name: string;
}

/**
 * Stars objects for the signed-in user and reads back what they starred.
 *
 * Grafana stores a star of any kind. It lists the stars of dashboards and folders, and of the app
 * plugin kinds that have a page, in its Starred navigation and on Home.
 * {@link StarsSrv.showsStarsOf} tells whether it lists a kind.
 *
 * The lists follow every star change. Grafana cannot see a plugin save or delete an object, so the
 * plugin reports that through {@link StarsSrv.resourceUpdated} and {@link StarsSrv.resourceDeleted}.
 */
export interface StarsSrv {
  /**
   * Whether Grafana lists starred objects of the kind. It stores a star of an unlisted kind all the
   * same. A plugin adds its kinds when its module loads, so the answer can change.
   */
  showsStarsOf(group: string, kind: string): boolean;
  /**
   * Stars the object, and shows Grafana's toast for the result. The Starred lists update on success.
   * Rejects when the server refuses, and for a user who cannot have stars, such as an anonymous user.
   */
  star(ref: StarredResourceRef): Promise<void>;
  /**
   * Unstars the object, and shows Grafana's toast for the result. The Starred lists update on success.
   * Rejects when the server refuses, and for a user who cannot have stars, such as an anonymous user.
   */
  unstar(ref: StarredResourceRef): Promise<void>;
  /**
   * The names (`metadata.name`) of the user's starred objects of a kind. Emits the current set on
   * subscribe, and again on each change, wherever in Grafana the change was made.
   *
   * Never errors. A set Grafana cannot read is emitted as empty, and the real set follows once a
   * read succeeds. For a user who cannot have stars it emits one empty set and completes.
   */
  starred(group: string, kind: string): Observable<readonly string[]>;
  /** Tells Grafana the object was saved. A starred object is searched again and listed under its saved title. */
  resourceUpdated(ref: StarredResourceRef): void;
  /** Tells Grafana the object was deleted. A starred object leaves the Starred lists. Its star stays stored. */
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
 * Used to retrieve the {@link StarsSrv}. Throws until Grafana has set it at startup.
 */
export const getStarsSrv = (): StarsSrv => {
  if (!singletonInstance) {
    throw new Error('StarsSrv is not set. Grafana sets it at startup; plugin tests mock getStarsSrv.');
  }
  return singletonInstance;
};
