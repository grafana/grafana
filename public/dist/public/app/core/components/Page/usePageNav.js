import { createSelector } from 'reselect';
import { getNavModel } from 'app/core/selectors/navModel';
import { store } from 'app/store/store';
import { useSelector } from 'app/types';
export function usePageNav(navId, oldProp) {
    if (oldProp) {
        return oldProp;
    }
    if (!navId) {
        return;
    }
    // Page component is used in so many tests, this simplifies not having to initialize a full redux store
    if (!store) {
        return;
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSelector(createSelector(getNavIndex, (navIndex) => getNavModel(navIndex, navId !== null && navId !== void 0 ? navId : 'home')));
}
function getNavIndex(store) {
    return store.navIndex;
}
//# sourceMappingURL=usePageNav.js.map