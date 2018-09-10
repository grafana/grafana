import _ from 'lodash';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export class FolderPickerCtrl {
  initialTitle: string;
  initialFolderId?: number;
  labelClass: string;
  onChange: any;
  onLoad: any;
  onCreateFolder: any;
  enterFolderCreation: any;
  exitFolderCreation: any;
  enableCreateNew: boolean;
  enableReset: boolean;
  rootName = 'General';
  folder: any;
  createNewFolder: boolean;
  newFolderName: string;
  newFolderNameTouched: boolean;
  hasValidationError: boolean;
  validationError: any;
  isEditor: boolean;

  /** @ngInject */
  constructor(private backendSrv, private validationSrv, private contextSrv) {
    this.isEditor = this.contextSrv.isEditor;

    if (!this.labelClass) {
      this.labelClass = 'width-7';
    }

    this.loadInitialValue();
  }

  getOptions(query) {
    const params = {
      query: query,
      type: 'dash-folder',
      permission: 'Edit',
    };

    return this.backendSrv.get('api/search', params).then(result => {
      if (
        this.isEditor &&
        (query === '' ||
          query.toLowerCase() === 'g' ||
          query.toLowerCase() === 'ge' ||
          query.toLowerCase() === 'gen' ||
          query.toLowerCase() === 'gene' ||
          query.toLowerCase() === 'gener' ||
          query.toLowerCase() === 'genera' ||
          query.toLowerCase() === 'general')
      ) {
        result.unshift({ title: this.rootName, id: 0 });
      }

      if (this.isEditor && this.enableCreateNew && query === '') {
        result.unshift({ title: '-- New Folder --', id: -1 });
      }

      if (this.enableReset && query === '' && this.initialTitle !== '') {
        result.unshift({ title: this.initialTitle, id: null });
      }

      return _.map(result, item => {
        return { text: item.title, value: item.id };
      });
    });
  }

  onFolderChange(option) {
    if (!option) {
      option = { value: 0, text: this.rootName };
    } else if (option.value === -1) {
      this.createNewFolder = true;
      this.enterFolderCreation();
      return;
    }
    this.onChange({ $folder: { id: option.value, title: option.text } });
  }

  newFolderNameChanged() {
    this.newFolderNameTouched = true;

    this.validationSrv
      .validateNewFolderName(this.newFolderName)
      .then(() => {
        this.hasValidationError = false;
      })
      .catch(err => {
        this.hasValidationError = true;
        this.validationError = err.message;
      });
  }

  createFolder(evt) {
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }

    return this.backendSrv.createFolder({ title: this.newFolderName }).then(result => {
      appEvents.emit('alert-success', ['Folder Created', 'OK']);

      this.closeCreateFolder();
      this.folder = { text: result.title, value: result.id };
      this.onFolderChange(this.folder);
    });
  }

  cancelCreateFolder(evt) {
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }

    this.closeCreateFolder();
    this.loadInitialValue();
  }

  private closeCreateFolder() {
    this.exitFolderCreation();
    this.createNewFolder = false;
    this.hasValidationError = false;
    this.validationError = null;
    this.newFolderName = '';
    this.newFolderNameTouched = false;
  }

  private loadInitialValue() {
    const resetFolder = { text: this.initialTitle, value: null };
    const rootFolder = { text: this.rootName, value: 0 };

    this.getOptions('').then(result => {
      let folder;
      if (this.initialFolderId) {
        folder = _.find(result, { value: this.initialFolderId });
      } else if (this.enableReset && this.initialTitle && this.initialFolderId === null) {
        folder = resetFolder;
      }

      if (!folder) {
        if (this.isEditor) {
          folder = rootFolder;
        } else {
          folder = result.length > 0 ? result[0] : resetFolder;
        }
      }

      this.folder = folder;

      // if this is not the same as our initial value notify parent
      if (this.folder.value !== this.initialFolderId) {
        this.onChange({ $folder: { id: this.folder.value, title: this.folder.text } });
      }
    });
  }
}

export function folderPicker() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/folder_picker/folder_picker.html',
    controller: FolderPickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      initialTitle: '<',
      initialFolderId: '<',
      labelClass: '@',
      rootName: '@',
      onChange: '&',
      onCreateFolder: '&',
      enterFolderCreation: '&',
      exitFolderCreation: '&',
      enableCreateNew: '@',
      enableReset: '@',
    },
  };
}

coreModule.directive('folderPicker', folderPicker);
