export const getSearchQuery = state => state.dashboardQuery.query;
export const getDashboardQuery = state => state.dashboardQuery;
export const getHasFilters = state => state.manageDashboard.hasFilters;
export const getSections = state => state.sections;
export const getFolderId = state => state.manageDashboard.folderId;
export const getHasEditPermissionInFolders = state => state.manageDashboard.hasEditPermissionInFolders;
export const getCanSave = state => state.manageDashboard.canSave;
export const getIsEditor = state => state.manageDashboard.isEditor;
