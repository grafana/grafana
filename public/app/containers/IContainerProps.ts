import { SearchStore } from './../stores/SearchStore';
import { ServerStatsStore } from './../stores/ServerStatsStore';
import { NavStore } from './../stores/NavStore';
import { AlertListStore } from './../stores/AlertListStore';
import { ViewStore } from './../stores/ViewStore';

export default interface IContainerProps {
  search: typeof SearchStore.Type;
  serverStats: typeof ServerStatsStore.Type;
  nav: typeof NavStore.Type;
  alertList: typeof AlertListStore.Type;
  view: typeof ViewStore.Type;
};
