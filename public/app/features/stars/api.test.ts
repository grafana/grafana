import { type UnknownAction } from '@reduxjs/toolkit';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setMockStarredDashboards, setMockStarredFolders } from '@grafana/test-utils/unstable';
import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { backendSrv } from 'app/core/services/backend_srv';
import { addExtraMiddleware, configureStore } from 'app/store/configureStore';

import { invalidateStarredSearch, invalidateStarredSearchFor } from './api';
import { userStarsFieldSelector } from './utils';

setBackendSrv(backendSrv);
setupMockServer();

const [, { dashbdD, folderA }] = getFolderFixtures();

// Records the starred search invalidations every store built in this file dispatches
const invalidations: UnknownAction[] = [];
addExtraMiddleware(() => (next) => (action) => {
  if (collectionsAPIv1alpha1.util.invalidateTags.match(action)) {
    invalidations.push(action);
  }
  return next(action);
});

describe('invalidateStarredSearchFor', () => {
  beforeEach(() => {
    invalidations.length = 0;
    setMockStarredDashboards([dashbdD.item.uid]);
    setMockStarredFolders([folderA.item.uid]);
  });

  it('re-searches the starred rows for a starred uid of either kind and leaves them alone for an unstarred one', async () => {
    const store = configureStore();
    // The star set as a mounted view would have cached it
    await store.dispatch(
      collectionsAPIv1alpha1.endpoints.listStars.initiate({ fieldSelector: userStarsFieldSelector() })
    );

    store.dispatch(invalidateStarredSearchFor(['nobody-starred-this']));
    expect(invalidations).toEqual([]);

    store.dispatch(invalidateStarredSearchFor(['nobody-starred-this', folderA.item.uid]));
    expect(invalidations).toEqual([invalidateStarredSearch()]);

    store.dispatch(invalidateStarredSearchFor([dashbdD.item.uid]));
    expect(invalidations).toEqual([invalidateStarredSearch(), invalidateStarredSearch()]);
  });

  it('leaves the rows alone while no view has loaded the star set', () => {
    const store = configureStore();

    store.dispatch(invalidateStarredSearchFor([dashbdD.item.uid]));

    expect(invalidations).toEqual([]);
  });
});
