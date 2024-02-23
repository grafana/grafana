import { debounce, isEqual } from 'lodash';

import { SceneObject, SceneObjectRef, SceneObjectUrlValues, getUrlSyncManager, sceneUtils } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';
import { TrailStepType } from '../DataTrailsHistory';
import { BOOKMARKED_TRAILS_KEY, RECENT_TRAILS_KEY } from '../shared';

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
  private _save;

  constructor() {
    this.load();

    this._save = debounce(() => {
      const serializedRecent = this._recent
        .slice(0, MAX_RECENT_TRAILS)
        .map((trail) => this._serializeTrail(trail.resolve()));
      localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify(serializedRecent));

      const serializedBookmarks = this._bookmarks.map((trail) => this._serializeTrail(trail.resolve()));
      localStorage.setItem(BOOKMARKED_TRAILS_KEY, JSON.stringify(serializedBookmarks));
    }, 1000);
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
    // reconstruct the trail based on the the serialized history
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

  setRecentTrail(trail: DataTrail) {
    this._recent = this._recent.filter((t) => t !== trail.getRef());

    // Check if any existing "recent" entries have equivalent 'current' urlValue to the new trail
    const newTrailUrlValues = getCurrentUrlValues(this._serializeTrail(trail)) || {};
    this._recent = this._recent.filter((t) => {
      // Use the current step urlValues to filter out equivalent states
      const urlValues = getCurrentUrlValues(this._serializeTrail(t.resolve()));
      // Only keep trails with sufficiently unique urlValues on their current step
      return !isEqual(newTrailUrlValues, urlValues);
    });

    this._recent.unshift(trail.getRef());
    this._save();
  }

  // Bookmarked Trails
  get bookmarks() {
    return this._bookmarks;
  }

  addBookmark(trail: DataTrail) {
    this._bookmarks.unshift(trail.getRef());
    this._refreshBookmarkIndexMap();
    this._save();
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

function getBookmarkKey(trail: DataTrail) {
  const urlState = getUrlSyncManager().getUrlState(trail);
  // Not part of state
  delete urlState.actionView;
  // Populate defaults
  if (urlState['var-groupby'] === '') {
    urlState['var-groupby'] = '$__all';
  }
  const key = JSON.stringify(urlState);
  return key;
}

let store: TrailStore | undefined;
export function getTrailStore(): TrailStore {
  if (!store) {
    store = new TrailStore();
  }

  return store;
}

function getCurrentUrlValues({ history, currentStep }: SerializedTrail) {
  return history[currentStep]?.urlValues || history.at(-1)?.urlValues;
}
