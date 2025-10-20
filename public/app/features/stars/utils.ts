import { locationUtil, NavModelItem } from '@grafana/data';
import { updateNavIndex } from 'app/core/actions';
import { ID_PREFIX, setStarred } from 'app/core/reducers/navBarTree';
import { removeNavIndex } from 'app/core/reducers/navModel';
import { AppDispatch } from 'app/store/configureStore';

/**
 * Dispatch the necessary actions to update the nav with starred items
 *
 * Exported separately to allow for use in RTKQ endpoints/places without hooks
 */
export const updateStarredNavItems = (
  dispatch: AppDispatch,
  starredNavItem: NavModelItem,
  id: string,
  title: string,
  isStarred: boolean
) => {
  const url = locationUtil.assureBaseUrl(`/d/${id}`);
  dispatch(setStarred({ id, title, url, isStarred }));

  const navID = ID_PREFIX + id;

  if (isStarred) {
    starredNavItem.children?.push({
      id: navID,
      text: title,
      url: url ?? '',
      parentItem: starredNavItem,
    });
  } else {
    dispatch(removeNavIndex(navID));
    starredNavItem.children = starredNavItem.children?.filter((element) => element.id !== navID);
  }
  dispatch(updateNavIndex(starredNavItem));
};
