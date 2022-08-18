import { useObservable } from 'react-use';
import { BehaviorSubject } from 'rxjs';

import { NavModelItem } from '@grafana/data';
import store from 'app/core/store';
import { isShallowEqual } from 'app/core/utils/isShallowEqual';

import { RouteDescriptor } from '../../navigation/types';

export interface AppChromeState {
  chromeless?: boolean;
  sectionNav: NavModelItem;
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
  searchBarHidden?: boolean;
  megaMenuOpen?: boolean;
}

const defaultSection: NavModelItem = { text: 'Grafana' };

export class AppChromeService {
  searchBarStorageKey = 'SearchBar_Hidden';
  private currentRoute?: RouteDescriptor;
  private routeChangeHandled?: boolean;

  readonly state = new BehaviorSubject<AppChromeState>({
    chromeless: true, // start out hidden to not flash it on pages without chrome
    sectionNav: defaultSection,
    searchBarHidden: store.getBool(this.searchBarStorageKey, false),
  });

  registerRouteRender(route: RouteDescriptor) {
    if (this.currentRoute !== route) {
      this.currentRoute = route;
      this.routeChangeHandled = false;
    }
  }

  update(update: Partial<AppChromeState>) {
    const current = this.state.getValue();
    const newState: AppChromeState = {
      ...current,
    };

    // when route change update props from route and clear fields
    if (!this.routeChangeHandled) {
      newState.actions = undefined;
      newState.pageNav = undefined;
      newState.sectionNav = defaultSection;
      newState.chromeless = this.currentRoute?.chromeless;
      this.routeChangeHandled = true;
    }

    Object.assign(newState, update);

    if (!isShallowEqual(current, newState)) {
      this.state.next(newState);
    }
  }

  toggleMegaMenu = () => {
    this.update({ megaMenuOpen: !this.state.getValue().megaMenuOpen });
  };

  setMegaMenu = (megaMenuOpen: boolean) => {
    this.update({ megaMenuOpen });
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
