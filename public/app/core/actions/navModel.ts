export type Action = UpdateNavIndexAction;

// this action is not used yet
// kind of just a placeholder, will be need for dynamic pages
// like datasource edit, teams edit page

export interface UpdateNavIndexAction {
  type: 'UPDATE_NAV_INDEX';
}

export const updateNavIndex = (): UpdateNavIndexAction => ({
  type: 'UPDATE_NAV_INDEX',
});
