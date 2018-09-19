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
  state.sections.map(section => {
    dashboards.push(section.items.filter(item => item.checked));
  });

  return dashboards;
};

export const getCanDelete = state => {
  let numberOfSelectedSections = 0;
  state.sections.sections.map(section => {
    if (section.checked) {
      numberOfSelectedSections++;
    }
  });

  let numberOfSelectedSectionItems = 0;
  state.sections.sections.map(section => {
    section.items.map(item => {
      if (item.checked) {
        numberOfSelectedSectionItems++;
      }
    });
  });

  return numberOfSelectedSections > 0 || numberOfSelectedSectionItems > 0;
};
export const getCanMove = state => {
  let numberOfSelectedSectionItems = 0;
  state.sections.sections.map(section => {
    section.items.map(item => {
      if (item.checked) {
        numberOfSelectedSectionItems++;
      }
    });
  });

  return numberOfSelectedSectionItems > 0;
};
