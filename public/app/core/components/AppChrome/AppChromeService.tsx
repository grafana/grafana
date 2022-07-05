import { useObservable } from 'react-use';
import { BehaviorSubject } from 'rxjs';

import { NavModelItem } from '@grafana/data';
import { isShallowEqual } from 'app/core/utils/isShallowEqual';

import { RouteDescriptor } from '../../navigation/types';

export interface AppChromeState {
  chromeless: boolean;
  sectionNav: NavModelItem;
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
}

const defaultSection: NavModelItem = { text: 'Grafana' };

export class AppChromeService {
  readonly state = new BehaviorSubject<AppChromeState>({
    chromeless: true, // start out hidden to not flash it on pages without chrome
    sectionNav: defaultSection,
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

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useObservable(this.state, this.state.getValue());
  }
}

export const appChromeService = new AppChromeService();
