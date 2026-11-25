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
 * {@link StarsSrv.canShowStarsOf} tells whether it can list a kind.
 *
 * The lists follow every star change. Grafana cannot see a plugin save or delete an object, so the
 * plugin reports that through {@link StarsSrv.resourceUpdated} and {@link StarsSrv.resourceDeleted}.
 * A change that nothing reports, such as one made in another tab, shows once the window regains focus.
 */
export interface StarsSrv {
  /**
   * Whether the current user can star: they are signed in and have a stars resource, which an
   * anonymous user has not. For anyone else {@link StarsSrv.star} and {@link StarsSrv.unstar} reject.
   */
  canStar(): boolean;
  /**
   * Whether Grafana can list starred objects of the kind: the kind is a dashboard or folder, or a
   * plugin added it to the kind registry with a page. Grafana finds a starred object through its
   * kind's search endpoint, so the objects of a kind served without one are still not listed. A star
   * of any kind is stored all the same. A plugin adds its kinds when its module loads, so the answer
   * can change.
   */
  canShowStarsOf(group: string, kind: string): boolean;
  /**
   * Stars the object. The Starred lists update on success, and Grafana shows nothing: the caller
   * confirms the star in its own way. When the server refuses, Grafana shows its error notification
   * and this rejects. It also rejects, with no notification, for a user who cannot star.
   */
  star(ref: StarredResourceRef): Promise<void>;
  /**
   * Unstars the object. The Starred lists update on success, and Grafana shows nothing. When the
   * server refuses, Grafana shows its error notification and this rejects. It also rejects, with no
   * notification, for a user who cannot star.
   */
  unstar(ref: StarredResourceRef): Promise<void>;
  /**
   * The names (`metadata.name`) of the user's starred objects of a kind. Emits the current set on
   * subscribe, and again on each change, wherever in Grafana the change was made.
   *
   * Never errors. If the first read fails it emits an empty set. If a later read fails it keeps the
   * set it last read. Either way the current set follows once a read succeeds. For a user who cannot
   * star it emits one empty set and completes.
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
