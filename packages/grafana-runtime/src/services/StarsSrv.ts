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
 * App plugins get this through {@link getStarsSrv}. Stars of any kind are stored. Grafana shows
 * its own kinds (dashboards, folders) and the kinds of installed app plugins it can link to,
 * wherever starred dashboards appear, and keeps its Starred navigation and lists in sync as stars
 * change. Until a kind can declare its page, Grafana links a starred object to the plugin page
 * whose path ends in the kind's plural (`/a/grafana-irm-app/incidents` for `incidents`), plus the
 * object's name; titles come from the kind's own `/search` endpoint, so the kind's app manifest has
 * to enable search.
 */
export interface StarsSrv {
  /** Whether Grafana shows starred objects of the kind. Stars of other kinds are stored but not shown. */
  canStar(group: string, kind: string): Promise<boolean>;
  /** Stars the object for the signed-in user. Rejects when Grafana refuses (e.g. not signed in, server error). Grafana's Starred navigation and lists update on success. */
  star(ref: StarredResourceRef): Promise<void>;
  /** Unstars the object for the signed-in user. Rejects when Grafana refuses (e.g. not signed in, server error). Grafana's Starred navigation and lists update on success. */
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
