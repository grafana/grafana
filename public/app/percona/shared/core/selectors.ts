import { createSelector } from '@reduxjs/toolkit';

import { Settings } from 'app/percona/settings/Settings.types';
import { StoreState } from 'app/types';

import { groupAdvisorsIntoCategories } from '../services/advisors/Advisors.utils';

export const getPerconaSettings = (state: StoreState) => state.percona.settings;
export const getPerconaSettingFlag = (setting: keyof Settings) => (state: StoreState) =>
  !!state.percona.settings.result?.[setting];
export const getPerconaUser = (state: StoreState) => state.percona.user;
export const getDBaaS = (state: StoreState) => state.percona.dbaas;
export const getKubernetes = (state: StoreState) => state.percona.kubernetes;
export const getDeleteKubernetes = (state: StoreState) => state.percona.deleteKubernetes;
export const getAddKubernetes = (state: StoreState) => state.percona.addKubernetes;
export const getUpdateDbCluster = (state: StoreState) => state.percona.updateDBCluster;
export const getAddDbCluster = (state: StoreState) => state.percona.addDBCluster;
export const getPerconaDBClusters = (state: StoreState) => state.percona.dbClusters;
export const getPerconaServer = (state: StoreState) => state.percona.server;
export const getTemplates = (state: StoreState) => state.percona.templates;
export const getServices = (state: StoreState) => state.percona.services;
export const getNodes = (state: StoreState) => state.percona.nodes;
export const getBackupLocations = (state: StoreState) => state.percona.backupLocations;
export const getTour = (state: StoreState) => state.percona.tour;
export const getAccessRoles = (state: StoreState) => state.percona.roles;
export const getUsers = (state: StoreState) => state.users;
export const getUsersInfo = (state: StoreState) => state.percona.users;
export const getDefaultRole = (state: StoreState) =>
  state.percona.roles.roles.find((r) => r.roleId === state.percona.settings.result?.defaultRoleId);
export const getAdvisors = (state: StoreState) => state.percona.advisors;
export const getCategorizedAdvisors = createSelector([getAdvisors], (advisors) =>
  groupAdvisorsIntoCategories(advisors.result || [])
);
