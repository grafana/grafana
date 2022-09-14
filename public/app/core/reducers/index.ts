import { appNotificationsReducer as appNotifications } from './appNotification';
import { fnSliceReducer as fnGlobalState } from './fn-slice';
import { navTreeReducer as navBarTree } from './navBarTree';
import { navIndexReducer as navIndex } from './navModel';

export default {
  navBarTree,
  navIndex,
  appNotifications,
  fnGlobalState,
};
