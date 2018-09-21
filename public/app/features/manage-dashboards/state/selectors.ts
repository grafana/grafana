export const getSearchQuery = state => state.dashboardQuery.query;
export const getDashboardQuery = state => state.dashboardQuery;
export const getFilterOnStarred = state => state.dashboardQuery.starred;
export const getHasFilters = state => {
  return state.dashboardQuery.tag.length > 0 || state.dashboardQuery.starred;
};

export const getFolderId = state => state.manageDashboard.folderId;
export const getHasEditPermissionInFolders = state => state.manageDashboard.hasEditPermissionInFolders;
export const getCanSave = state => state.manageDashboard.canSave;
export const getIsEditor = state => state.manageDashboard.isEditor;
export const getSelectedTagFilter = state => state.manageDashboard.selectedTagFilter;

export const getSections = state => state.sections;
export const getAllChecked = state => state.allChecked;
export const getTagFilterOptions = state => [{ term: 'Filter By Tag', disabled: true }].concat(state.dashboardTags);
export const getSelectedDashboards = state => {
  const dashboards = [];

  state.sections.forEach(section => {
    dashboards.push(...selectedDashboardsUid(section.items));
  });

  return dashboards;
};

export const getSelectedFoldersAndDashboards = state => {
  const folders = [];
  const dashboards = [];

  state.sections.forEach(section => {
    if (section.checked) {
      folders.push(section.uid);
    }

    dashboards.push(...selectedDashboardsUid(section.items));
  });

  return { folders, dashboards };
};

export const getCanDelete = state => {
  let numberOfSelectedSections = 0;
  let numberOfSelectedSectionItems = 0;

  state.sections.forEach(section => {
    if (section.checked) {
      numberOfSelectedSections++;
    }

    numberOfSelectedSectionItems = selectedDashboardsUid(section.items).length;
  });

  return numberOfSelectedSections > 0 || numberOfSelectedSectionItems > 0;
};

export const getCanMove = state => {
  let numberOfSelectedSectionItems = 0;

  state.sections.forEach(section => {
    numberOfSelectedSectionItems = selectedDashboardsUid(section.items).length;
  });

  return numberOfSelectedSectionItems > 0;
};

const selectedDashboardsUid = items => {
  const uIds = [];

  items.forEach(item => {
    if (item.checked) {
      uIds.push(item.uid);
    }
  });

  return uIds;
};
