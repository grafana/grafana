import { Subscription } from 'rxjs';

import {
  InternalScopeNodesMap,
  InternalSelectedScope,
  InternalSuggestedDashboardsFoldersMap,
  InternalTreeScope,
  ScopeDashboardBinding,
} from '@grafana/data';
import {
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';

export interface ScopesSelectorLikeState extends SceneObjectState {
  dashboards: SceneObjectRef<ScopesDashboardsLike> | null;
  nodes: InternalScopeNodesMap;
  loadingNodeName: string | undefined;
  scopes: InternalSelectedScope[];
  treeScopes: InternalTreeScope[];
  isReadOnly: boolean;
  isLoadingScopes: boolean;
  isPickerOpened: boolean;
  isEnabled: boolean;
}

export abstract class ScopesSelectorLike
  extends SceneObjectBase<ScopesSelectorLikeState>
  implements SceneObjectWithUrlSync
{
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scopes'] });
  protected nodesFetchingSub: Subscription | undefined;
  abstract getUrlState(): { scopes: string[] };
  abstract updateFromUrl(values: SceneObjectUrlValues): void;
  abstract fetchBaseNodes(): Promise<void>;
  abstract updateNode(path: string[], isExpanded: boolean, query: string): Promise<void>;
  abstract toggleNodeSelect(path: string[]): void;
  abstract openPicker(): void;
  abstract closePicker(): void;
  abstract updateScopes(treeScopes?: InternalTreeScope[]): Promise<void>;
  abstract resetDirtyScopeNames(): void;
  abstract removeAllScopes(): void;
  abstract enterReadOnly(): void;
  abstract exitReadOnly(): void;
  abstract enable(): void;
  abstract disable(): void;
  abstract closeNodes(nodes: InternalScopeNodesMap): InternalScopeNodesMap;
  abstract expandNodes(nodes: InternalScopeNodesMap, path: string[]): InternalScopeNodesMap;
}

export interface ScopesDashboardsLikeState extends SceneObjectState {
  selector: SceneObjectRef<ScopesSelectorLike> | null;
  // by keeping a track of the raw response, it's much easier to check if we got any dashboards for the currently selected scopes
  dashboards: ScopeDashboardBinding[];
  // this is a grouping in folders of the `dashboards` property. it is used for filtering the dashboards and folders when the search query changes
  folders: InternalSuggestedDashboardsFoldersMap;
  // a filtered version of the `folders` property. this prevents a lot of unnecessary parsings in React renders
  filteredFolders: InternalSuggestedDashboardsFoldersMap;
  forScopeNames: string[];
  isLoading: boolean;
  isPanelOpened: boolean;
  isEnabled: boolean;
  isReadOnly: boolean;
  scopesSelected: boolean;
  searchQuery: string;
}

export abstract class ScopesDashboardsLike extends SceneObjectBase<ScopesDashboardsLikeState> {
  protected dashboardsFetchingSub: Subscription | undefined;
  abstract fetchDashboards(): Promise<void>;
  abstract changeSearchQuery(searchQuery: string): void;
  abstract updateFolder(path: string[], isExpanded: boolean): void;
  abstract togglePanel(): void;
  abstract openPanel(): void;
  abstract closePanel(): void;
  abstract enable(): void;
  abstract disable(): void;
  abstract enterReadOnly(): void;
  abstract exitReadOnly(): void;
}

let scopesSelectorSingletonInstance: ScopesSelectorLike | null = null;
let scopesDashboardsSingletonInstance: ScopesDashboardsLike | null = null;

/**
 * Used during startup by Grafana to set the {@link ScopesSelectorLike} so it is available
 * via the {@link getScopesSelector} to the rest of the application.
 *
 * @internal
 */
export function setScopesSelector(instance: ScopesSelectorLike) {
  scopesSelectorSingletonInstance = instance;
}

/**
 * Used to retrieve the {@link ScopesSelectorLike}.
 *
 * @public
 */
export function getScopesSelector(): ScopesSelectorLike | null {
  return scopesSelectorSingletonInstance;
}

/**
 * Used during startup by Grafana to set the {@link ScopesDashboardsLike} so it is available
 * via the {@link getScopesDashboards} to the rest of the application.
 *
 * @internal
 */
export function setScopesDashboards(instance: ScopesDashboardsLike) {
  scopesDashboardsSingletonInstance = instance;
}

/**
 * Used to retrieve the {@link ScopesDashboardsLike}.
 *
 * @public
 */
export function getScopesDashboards(): ScopesDashboardsLike | null {
  return scopesDashboardsSingletonInstance;
}
