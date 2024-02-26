import { useState } from 'react';

import { DataTrail } from '../DataTrail';

import { getTrailStore } from './TrailStore';

export function useBookmarkState(trail: DataTrail) {
  // Note that trail object may stay the same, but the state used by `getBookmarkIndex` result may
  // differ for each re-render of this hook
  const getBookmarkIndex = () => getTrailStore().getBookmarkIndex(trail);

  const indexOnRender = getBookmarkIndex();

  const [bookmarkIndex, setBookmarkIndex] = useState(indexOnRender);

  // Check if index changed and force a re-render
  if (indexOnRender !== bookmarkIndex) {
    setBookmarkIndex(indexOnRender);
  }

  const isBookmarked = bookmarkIndex != null;

  const toggleBookmark = () => {
    if (isBookmarked) {
      let indexToRemove = getBookmarkIndex();
      while (indexToRemove != null) {
        // This loop will remove all indices that have an equivalent bookmark key
        getTrailStore().removeBookmark(indexToRemove);
        indexToRemove = getBookmarkIndex();
      }
    } else {
      getTrailStore().addBookmark(trail);
    }
    setBookmarkIndex(getBookmarkIndex());
  };

  const result: [typeof isBookmarked, typeof toggleBookmark] = [isBookmarked, toggleBookmark];
  return result;
}
