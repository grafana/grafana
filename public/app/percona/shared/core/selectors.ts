import { Settings } from 'app/percona/settings/Settings.types';
import { StoreState } from 'app/types';

export const getPerconaSettings = (state: StoreState) => state.percona.settings;
export const getPerconaSettingFlag = (setting: keyof Settings) => (state: StoreState) =>
  !!state.percona.settings.result?.[setting];
export const getPerconaUser = (state: StoreState) => state.percona.user;
export const getKubernetes = (state: StoreState) => state.percona.kubernetes;
export const getDeleteKubernetes = (state: StoreState) => state.percona.deleteKubernetes;
export const getAddKubernetes = (state: StoreState) => state.percona.addKubernetes;
export const getPerconaDBClusters = (state: StoreState) => state.percona.dbCluster;
export const getPerconaServer = (state: StoreState) => state.percona.server;
