import { type Observable } from 'rxjs';

import { type IconName } from '@grafana/data';

/** One object a user can star: which kind it is (`group`/`kind`), its `metadata.name` (`id`), and a title to show in Starred lists. */
export interface StarredResourceRef {
  group: string;
  kind: string;
  id: string;
  title: string;
}

/**
 * A kind an app plugin serves whose objects Grafana should show wherever starred dashboards appear:
 * the Starred section of the navigation, the Home Starred tab, `/dashboards?starred` and the
 * Dashboard list panel. Titles come from the kind's own `/search` endpoint, so the kind's app
 * manifest has to enable search.
 */
export interface StarredKindRegistration {
  /** API group of the kind, e.g. `irm.grafana.app`. */
  group: string;
  /** Kind name as served by the API, e.g. `Incident`. */
  kind: string;
  /** Where the plugin lists the kind, e.g. `/a/grafana-irm-app/incidents`; an object's page is `${listUrl}/${metadata.name}`. */
  listUrl: string;
  /** Singular display name of the kind, e.g. `Incident`. */
  title: string;
  /** Icon shown next to starred objects of the kind. */
  icon?: IconName;
}

/**
 * Stars objects on behalf of the signed-in user and reads back what they have starred.
 *
 * App plugins get this through {@link getStarsSrv}. Stars of any kind are stored; Grafana shows
 * its own kinds (dashboards, folders) and every kind a plugin has registered, and keeps its
 * Starred navigation and lists in sync as stars change.
 */
export interface StarsSrv {
  /**
   * Registers a kind so Grafana shows its starred objects. Call it when the plugin module loads;
   * objects of a kind registered later than that appear once it is. Returns the unregister function.
   */
  registerKind(registration: StarredKindRegistration): () => void;
  /** Whether Grafana shows starred objects of the kind: its own kinds, or one a plugin has registered. Stars of other kinds are stored but not shown. */
  canStar(group: string, kind: string): boolean;
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
