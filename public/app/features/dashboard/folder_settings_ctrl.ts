import { FolderPageLoader } from './folder_page_loader';
import appEvents from 'app/core/app_events';

export class FolderSettingsCtrl {
  folderPageLoader: FolderPageLoader;
  navModel: any;
  folderId: number;
  canSave = false;
  dashboard: any;
  meta: any;

  /** @ngInject */
  constructor(
    private backendSrv,
    navModelSrv,
    private $routeParams,
    private $location
  ) {
    if (this.$routeParams.folderId && this.$routeParams.slug) {
      this.folderId = $routeParams.folderId;

      this.folderPageLoader = new FolderPageLoader(
        this.backendSrv,
        this.$routeParams
      );
      this.folderPageLoader
        .load(this, this.folderId, 'manage-folder-settings')
        .then(result => {
          this.dashboard = result.dashboard;
          this.meta = result.meta;
          this.canSave = result.meta.canSave;
        });
    }
  }

  save() {
    return this.backendSrv
      .saveDashboard(this.dashboard, { overwrite: false })
      .then(result => {
        var folderUrl = this.folderPageLoader.createFolderUrl(
          this.folderId,
          this.meta.type,
          result.slug
        );
        if (folderUrl !== this.$location.path()) {
          this.$location.url(folderUrl + '/settings');
        }

        appEvents.emit('dashboard-saved');
        appEvents.emit('alert-success', ['Folder saved']);
      })
      .catch(this.handleSaveFolderError);
  }

  delete(evt) {
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }

    appEvents.emit('confirm-modal', {
      title: 'Delete',
      text: `Do you want to delete this folder and all its dashboards?`,
      icon: 'fa-trash',
      yesText: 'Delete',
      onConfirm: () => {
        return this.backendSrv.deleteDashboard(this.meta.slug).then(() => {
          appEvents.emit('alert-success', [
            'Folder Deleted',
            `${this.dashboard.title} has been deleted`,
          ]);
          this.$location.url('/dashboards');
        });
      },
    });
  }

  handleSaveFolderError(err) {
    if (err.data && err.data.status === 'version-mismatch') {
      err.isHandled = true;

      appEvents.emit('confirm-modal', {
        title: 'Conflict',
        text: 'Someone else has updated this folder.',
        text2: 'Would you still like to save this folder?',
        yesText: 'Save & Overwrite',
        icon: 'fa-warning',
        onConfirm: () => {
          this.backendSrv.saveDashboard(this.dashboard, { overwrite: true });
        },
      });
    }

    if (err.data && err.data.status === 'name-exists') {
      err.isHandled = true;

      appEvents.emit('alert-error', [
        'A folder or dashboard with this name exists already.',
      ]);
    }
  }
}
