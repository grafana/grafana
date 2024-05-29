import { debounce, isEqual } from 'lodash';

import { getUrlSyncManager, SceneObject, SceneObjectRef, SceneObjectUrlValues, sceneUtils } from '@grafana/scenes';
import { dispatch } from 'app/store/store';

import { notifyApp } from '../../../core/reducers/appNotification';
import { DataTrail } from '../DataTrail';
import { TrailStepType } from '../DataTrailsHistory';
import { BOOKMARKED_TRAILS_KEY, RECENT_TRAILS_KEY } from '../shared';

import { createBookmarkSavedNotification } from './utils';

const MAX_RECENT_TRAILS = 20;

export interface SerializedTrail {
  history: Array<{
    urlValues: SceneObjectUrlValues;
    type: TrailStepType;
    description: string;
    parentIndex: number;
  }>;
  currentStep: number;
  createdAt?: number;
}

export class TrailStore {
  private _recent: Array<SceneObjectRef<DataTrail>> = [];
  private _bookmarks: Array<SceneObjectRef<DataTrail>> = [];
  private _save: () => void;

  constructor() {
    this.load();

    const doSave = () => {
      const serializedRecent = this._recent
        .slice(0, MAX_RECENT_TRAILS)
        .map((trail) => this._serializeTrail(trail.resolve()));
      localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify(serializedRecent));

      const serializedBookmarks = this._bookmarks.map((trail) => this._serializeTrail(trail.resolve()));
      localStorage.setItem(BOOKMARKED_TRAILS_KEY, JSON.stringify(serializedBookmarks));
    };

    this._save = debounce(doSave, 1000);

    window.addEventListener('beforeunload', (ev) => {
      // Before closing or reloading the page, we want to remove the debounce from `_save` so that
      // any calls to is on event `unload` are actualized. Debouncing would cause a delay until after the page has been unloaded.
      this._save = doSave;
    });
  }

  private _loadFromStorage(key: string) {
    const list: Array<SceneObjectRef<DataTrail>> = [];
    const storageItem = localStorage.getItem(key);

    if (storageItem) {
      const serializedTrails: SerializedTrail[] = JSON.parse(storageItem);
      for (const t of serializedTrails) {
        const trail = this._deserializeTrail(t);
        list.push(trail.getRef());
      }
    }
    return list;
  }

  private _deserializeTrail(t: SerializedTrail): DataTrail {
    // reconstruct the trail based on the serialized history
    const trail = new DataTrail({ createdAt: t.createdAt });

    t.history.map((step) => {
      this._loadFromUrl(trail, step.urlValues);
      const parentIndex = step.parentIndex ?? trail.state.history.state.steps.length - 1;
      // Set the parent of the next trail step by setting the current step in history.
      trail.state.history.setState({ currentStep: parentIndex });
      trail.state.history.addTrailStep(trail, step.type);
    });

    const currentStep = t.currentStep ?? trail.state.history.state.steps.length - 1;
    trail.state.history.setState({ currentStep });
    // The state change listeners aren't activated yet, so maually change to the current step state
    trail.setState(trail.state.history.state.steps[currentStep].trailState);

    return trail;
  }

  private _serializeTrail(trail: DataTrail): SerializedTrail {
    const history = trail.state.history.state.steps.map((step) => {
      const stepTrail = new DataTrail(sceneUtils.cloneSceneObjectState(step.trailState));
      return {
        urlValues: getUrlSyncManager().getUrlState(stepTrail),
        type: step.type,
        description: step.description,
        parentIndex: step.parentIndex,
      };
    });
    return {
      history,
      currentStep: trail.state.history.state.currentStep,
      createdAt: trail.state.createdAt,
    };
  }

  private _loadFromUrl(node: SceneObject, urlValues: SceneObjectUrlValues) {
    node.urlSync?.updateFromUrl(urlValues);
    node.forEachChild((child) => this._loadFromUrl(child, urlValues));
  }

  // Recent Trails
  get recent() {
    return this._recent;
  }

  load() {
    this._recent = this._loadFromStorage(RECENT_TRAILS_KEY);
    this._bookmarks = this._loadFromStorage(BOOKMARKED_TRAILS_KEY);
    this._refreshBookmarkIndexMap();
  }

  setRecentTrail(recentTrail: DataTrail) {
    const { steps } = recentTrail.state.history.state;
    if (steps.length === 0 || (steps.length === 1 && steps[0].type === 'start')) {
      // We do not set an uninitialized trail, or a single node "start" trail as recent
      return;
    }

    // Remove the `recentTrail` from the list if it already exists there
    this._recent = this._recent.filter((t) => t !== recentTrail.getRef());

    // Check if any existing "recent" entries have equivalent urlState to the new recentTrail
    const recentUrlState = getUrlStateForComparison(recentTrail); //
    this._recent = this._recent.filter((t) => {
      // Use the current step urlValues to filter out equivalent states
      const urlState = getUrlStateForComparison(t.resolve());
      // Only keep trails with sufficiently unique urlValues on their current step
      return !isEqual(recentUrlState, urlState);
    });

    this._recent.unshift(recentTrail.getRef());
    this._save();
  }

  findMatchingRecentTrail(trail: DataTrail) {
    const matchUrlState = getUrlStateForComparison(trail);
    return this._recent.find((t) => {
      const urlState = getUrlStateForComparison(t.resolve());
      return isEqual(matchUrlState, urlState);
    });
  }

  // Bookmarked Trails
  get bookmarks() {
    return this._bookmarks;
  }

  addBookmark(trail: DataTrail) {
    const bookmark = new DataTrail(sceneUtils.cloneSceneObjectState(trail.state));
    this._bookmarks.unshift(bookmark.getRef());
    this._refreshBookmarkIndexMap();
    this._save();
    dispatch(notifyApp(createBookmarkSavedNotification()));
  }

  removeBookmark(index: number) {
    if (index < this._bookmarks.length) {
      this._bookmarks.splice(index, 1);
      this._refreshBookmarkIndexMap();
      this._save();
    }
  }

  getBookmarkIndex(trail: DataTrail) {
    const bookmarkKey = getBookmarkKey(trail);
    const bookmarkIndex = this._bookmarkIndexMap.get(bookmarkKey);
    return bookmarkIndex;
  }

  private _bookmarkIndexMap = new Map<string, number>();

  private _refreshBookmarkIndexMap() {
    this._bookmarkIndexMap.clear();
    this._bookmarks.forEach((bookmarked, index) => {
      const trail = bookmarked.resolve();

      const key = getBookmarkKey(trail);
      // If there are duplicate bookmarks, the latest index will be kept
      this._bookmarkIndexMap.set(key, index);
    });
  }
}

function getUrlStateForComparison(trail: DataTrail) {
  const urlState = getUrlSyncManager().getUrlState(trail);
  // Make a few corrections

  // Omit some URL parameters that are not useful for state comparison
  delete urlState.actionView;
  delete urlState.layout;

  // Populate defaults
  if (urlState['var-groupby'] === '') {
    urlState['var-groupby'] = '$__all';
  }

  return urlState;
}

function getBookmarkKey(trail: DataTrail) {
  const key = JSON.stringify(getUrlStateForComparison(trail));
  return key;
}

let store: TrailStore | undefined;
export function getTrailStore(): TrailStore {
  if (!store) {
    store = new TrailStore();
  }

  return store;
}
