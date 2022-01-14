export const Messages = {
  title: 'Delete Storage Location',
  deleteLocationWarning:
    'This action will only remove the Storage Location from PMM inventory, but will not delete the physical storage.',
  getDeleteMessage: (name: string) => `Are you sure you want to delete the Storage Location "${name}"?`,
};
