import { useObservable } from 'react-use';
import { BehaviorSubject } from 'rxjs';

import { NavModelItem } from '@grafana/data';
import store from 'app/core/store';
import { isShallowEqual } from 'app/core/utils/isShallowEqual';

import { RouteDescriptor } from '../../navigation/types';

export interface AppChromeState {
  chromeless: boolean;
  sectionNav: NavModelItem;
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
  searchBarHidden?: boolean;
  megaMenuOpen?: boolean;
}

const defaultSection: NavModelItem = { text: 'Grafana' };

export class AppChromeService {
  searchBarStorageKey = 'SearchBar_Hidden';

  readonly state = new BehaviorSubject<AppChromeState>({
    chromeless: true, // start out hidden to not flash it on pages without chrome
    sectionNav: defaultSection,
    searchBarHidden: store.getBool(this.searchBarStorageKey, false),
  });

  routeMounted(route: RouteDescriptor) {
    this.update({
      chromeless: route.chromeless === true,
      sectionNav: defaultSection,
      pageNav: undefined,
      actions: undefined,
    });
  }

  update(state: Partial<AppChromeState>) {
    const current = this.state.getValue();
    const newState: AppChromeState = {
      ...current,
      ...state,
    };

    if (!isShallowEqual(current, newState)) {
      this.state.next(newState);
    }
  }

  toggleMegaMenu = () => {
    this.update({ megaMenuOpen: !this.state.getValue().megaMenuOpen });
  };

  toggleSearchBar = () => {
    const searchBarHidden = !this.state.getValue().searchBarHidden;
    store.set(this.searchBarStorageKey, searchBarHidden);
    this.update({ searchBarHidden });
  };

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useObservable(this.state, this.state.getValue());
  }
}

export const appChromeService = new AppChromeService();
