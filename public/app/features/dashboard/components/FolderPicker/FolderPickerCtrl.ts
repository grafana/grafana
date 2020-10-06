import _ from 'lodash';
import { IScope } from 'angular';
import { AppEvents } from '@grafana/data';

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { backendSrv } from 'app/core/services/backend_srv';
import { ValidationSrv } from 'app/features/manage-dashboards';
import { ContextSrv } from 'app/core/services/context_srv';
import { promiseToDigest } from '../../../../core/utils/promiseToDigest';
import { createFolder } from 'app/features/manage-dashboards/state/actions';

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
  dashboardId?: number;

  /** @ngInject */
  constructor(private validationSrv: ValidationSrv, private contextSrv: ContextSrv, private $scope: IScope) {
    this.isEditor = this.contextSrv.isEditor;

    if (!this.labelClass) {
      this.labelClass = 'width-7';
    }

    this.loadInitialValue();
  }

  getOptions(query: string) {
    const params = {
      query,
      type: 'dash-folder',
      permission: 'Edit',
    };

    return promiseToDigest(this.$scope)(
      backendSrv.get('api/search', params).then((result: any) => {
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
      })
    );
  }

  onFolderChange(option: { value: number; text: string }) {
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
      .catch((err: any) => {
        this.hasValidationError = true;
        this.validationError = err.message;
      });
  }

  createFolder(evt: any) {
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }

    return promiseToDigest(this.$scope)(
      createFolder({ title: this.newFolderName }).then((result: { title: string; id: number }) => {
        appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);

        this.closeCreateFolder();
        this.folder = { text: result.title, value: result.id };
        this.onFolderChange(this.folder);
      })
    );
  }

  cancelCreateFolder(evt: any) {
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
    const resetFolder: { text: string; value: any } = { text: this.initialTitle, value: null };
    const rootFolder: { text: string; value: any } = { text: this.rootName, value: 0 };

    this.getOptions('').then((result: any[]) => {
      let folder: { text: string; value: any } | undefined;

      if (this.initialFolderId) {
        // @ts-ignore
        folder = _.find(result, { value: this.initialFolderId });
      } else if (this.enableReset && this.initialTitle && this.initialFolderId === null) {
        folder = resetFolder;
      }

      if (!folder) {
        if (this.isEditor) {
          folder = rootFolder;
        } else {
          // We shouldn't assign a random folder without the user actively choosing it on a persisted dashboard
          const isPersistedDashBoard = this.dashboardId ? true : false;
          if (isPersistedDashBoard) {
            folder = resetFolder;
          } else {
            folder = result.length > 0 ? result[0] : resetFolder;
          }
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
    templateUrl: 'public/app/features/dashboard/components/FolderPicker/template.html',
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
      dashboardId: '<?',
    },
  };
}

coreModule.directive('folderPicker', folderPicker);
