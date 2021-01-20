export const Messages = {
  getEnabledMessage: (summary: string) => `Alert rule "${summary}" successfully enabled`,
  getDisabledMessage: (summary: string) => `Alert rule "${summary}" successfully disabled`,
  getCreatedMessage: (summary: string) => `Alert rule ${summary} successfully created`,
  getDeletedMessage: (summary: string) => `Alert rule ${summary} successfully deleted`,
  getDeleteModalMessage: (name: string) => `Are you sure you want to delete the alert rule "${name}"?`,
  copyOf: 'Copy of',
  deleteModalTitle: 'Delete Alert Rule',
};
