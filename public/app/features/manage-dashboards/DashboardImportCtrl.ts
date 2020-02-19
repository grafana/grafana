import _ from 'lodash';
import config from 'app/core/config';
import locationUtil from 'app/core/utils/location_util';
import { ValidationSrv } from './services/ValidationSrv';
import { NavModelSrv } from 'app/core/core';
import { ILocationService, IScope } from 'angular';
import { backendSrv } from 'app/core/services/backend_srv';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

export class DashboardImportCtrl {
  navModel: any;
  step: number;
  jsonText: string;
  parseError: string;
  nameExists: boolean;
  uidExists: boolean;
  dash: any;
  inputs: any[];
  inputsValid: boolean;
  gnetUrl: string;
  gnetError: string;
  gnetInfo: any;
  titleTouched: boolean;
  hasNameValidationError: boolean;
  nameValidationError: any;
  hasUidValidationError: boolean;
  uidValidationError: any;
  autoGenerateUid: boolean;
  autoGenerateUidValue: string;
  folderId: number;
  initialFolderTitle: string;
  isValidFolderSelection: boolean;

  /** @ngInject */
  constructor(
    private $scope: IScope,
    private validationSrv: ValidationSrv,
    navModelSrv: NavModelSrv,
    private $location: ILocationService,
    $routeParams: any
  ) {
    this.navModel = navModelSrv.getNav('create', 'import');

    this.step = 1;
    this.nameExists = false;
    this.uidExists = false;
    this.autoGenerateUid = true;
    this.autoGenerateUidValue = 'auto-generated';
    this.folderId = $routeParams.folderId ? Number($routeParams.folderId) || 0 : null;
    this.initialFolderTitle = 'Select a folder';

    // check gnetId in url
    if ($routeParams.gnetId) {
      this.gnetUrl = $routeParams.gnetId;
      this.checkGnetDashboard();
    }
  }

  onUpload(dash: any) {
    this.dash = dash;
    this.dash.id = null;
    this.step = 2;
    this.inputs = [];

    if (this.dash.__inputs) {
      for (const input of this.dash.__inputs) {
        const inputModel: any = {
          name: input.name,
          label: input.label,
          info: input.description,
          value: input.value,
          type: input.type,
          pluginId: input.pluginId,
          options: [],
        };

        if (input.type === 'datasource') {
          this.setDatasourceOptions(input, inputModel);
        } else if (!inputModel.info) {
          inputModel.info = 'Specify a string constant';
        }

        this.inputs.push(inputModel);
      }
    }

    this.inputsValid = this.inputs.length === 0;
    this.titleChanged();
    this.uidChanged(true);
  }

  setDatasourceOptions(input: { pluginId: string; pluginName: string }, inputModel: any) {
    const sources = _.filter(config.datasources, val => {
      return val.type === input.pluginId;
    });

    if (sources.length === 0) {
      inputModel.info = 'No data sources of type ' + input.pluginName + ' found';
    } else if (!inputModel.info) {
      inputModel.info = 'Select a ' + input.pluginName + ' data source';
    }

    inputModel.options = sources.map(val => {
      return { text: val.name, value: val.name };
    });
  }

  inputValueChanged() {
    this.inputsValid = true;
    for (const input of this.inputs) {
      if (!input.value) {
        this.inputsValid = false;
      }
    }
  }

  titleChanged() {
    this.titleTouched = true;
    this.nameExists = false;

    promiseToDigest(this.$scope)(
      this.validationSrv
        .validateNewDashboardName(this.folderId, this.dash.title)
        .then(() => {
          this.nameExists = false;
          this.hasNameValidationError = false;
        })
        .catch(err => {
          if (err.type === 'EXISTING') {
            this.nameExists = true;
          }

          this.hasNameValidationError = true;
          this.nameValidationError = err.message;
        })
    );
  }

  uidChanged(initial: boolean) {
    this.uidExists = false;
    this.hasUidValidationError = false;

    if (initial === true && this.dash.uid) {
      this.autoGenerateUidValue = 'value set';
    }

    if (!this.dash.uid) {
      return;
    }

    promiseToDigest(this.$scope)(
      backendSrv
        // @ts-ignore
        .getDashboardByUid(this.dash.uid)
        .then((res: any) => {
          this.uidExists = true;
          this.hasUidValidationError = true;
          this.uidValidationError = `Dashboard named '${res.dashboard.title}' in folder '${res.meta.folderTitle}' has the same uid`;
        })
        .catch((err: any) => {
          err.isHandled = true;
        })
    );
  }

  onFolderChange = (folder: any) => {
    this.folderId = folder.id;
    this.titleChanged();
  };

  onEnterFolderCreation = () => {
    this.inputsValid = false;
  };

  onExitFolderCreation = () => {
    this.inputValueChanged();
  };

  isValid() {
    return this.inputsValid && this.folderId !== null;
  }

  saveDashboard() {
    const inputs = this.inputs.map(input => {
      return {
        name: input.name,
        type: input.type,
        pluginId: input.pluginId,
        value: input.value,
      };
    });

    return promiseToDigest(this.$scope)(
      backendSrv
        .post('api/dashboards/import', {
          dashboard: this.dash,
          overwrite: true,
          inputs: inputs,
          folderId: this.folderId,
        })
        .then(res => {
          const dashUrl = locationUtil.stripBaseFromUrl(res.importedUrl);
          this.$location.url(dashUrl);
        })
    );
  }

  loadJsonText() {
    try {
      this.parseError = '';
      const dash = JSON.parse(this.jsonText);
      this.onUpload(dash);
    } catch (err) {
      console.log(err);
      this.parseError = err.message;
      return;
    }
  }

  checkGnetDashboard() {
    this.gnetError = '';

    const match = /(^\d+$)|dashboards\/(\d+)/.exec(this.gnetUrl);
    let dashboardId;

    if (match && match[1]) {
      dashboardId = match[1];
    } else if (match && match[2]) {
      dashboardId = match[2];
    } else {
      this.gnetError = 'Could not find dashboard';
    }

    return promiseToDigest(this.$scope)(
      backendSrv
        .get('api/gnet/dashboards/' + dashboardId)
        .then(res => {
          this.gnetInfo = res;
          // store reference to grafana.com
          res.json.gnetId = res.id;
          this.onUpload(res.json);
        })
        .catch(err => {
          err.isHandled = true;
          this.gnetError = err.data.message || err;
        })
    );
  }

  back() {
    this.gnetUrl = '';
    this.step = 1;
    this.gnetError = '';
    this.gnetInfo = '';
  }
}

export default DashboardImportCtrl;
