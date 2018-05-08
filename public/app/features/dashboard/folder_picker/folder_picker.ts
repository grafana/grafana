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

      return _.map(result, item => {
        return { text: item.title, value: item.id };
      });
    });
  }

  onFolderChange(option) {
    if (option.value === -1) {
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
      this.folder = {
        text: result.title,
        value: result.id,
      };
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
    if (this.initialFolderId && this.initialFolderId > 0) {
      this.getOptions('').then(result => {
        this.folder = _.find(result, { value: this.initialFolderId });
        if (!this.folder) {
          this.folder = { text: this.initialTitle, value: this.initialFolderId };
        }
        this.onFolderLoad();
      });
    } else {
      if (this.initialTitle) {
        this.folder = { text: this.initialTitle, value: null };
      } else {
        this.folder = { text: this.rootName, value: 0 };
      }

      this.onFolderLoad();
    }
  }

  private onFolderLoad() {
    if (this.onLoad) {
      this.onLoad({
        $folder: { id: this.folder.value, title: this.folder.text },
      });
    }
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
      onLoad: '&',
      onCreateFolder: '&',
      enterFolderCreation: '&',
      exitFolderCreation: '&',
      enableCreateNew: '@',
    },
  };
}

coreModule.directive('folderPicker', folderPicker);
