export class StackdriverConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/stackdriver/partials/config.html';
  datasourceSrv: any;
  current: any;
  jsonText: string;
  validationErrors: string[] = [];
  inputDataValid: boolean;
  defaultProject: string;
  projects: string[];
  loadingProjects: boolean;

  /** @ngInject */
  constructor($scope, datasourceSrv) {
    this.datasourceSrv = datasourceSrv;
    this.current.jsonData = this.current.jsonData || {};
    this.current.secureJsonData = this.current.secureJsonData || {};
    this.projects = [];
  }

  save(jwt) {
    this.current.secureJsonData.privateKey = jwt.private_key;
    this.current.jsonData.tokenUri = jwt.token_uri;
    this.current.jsonData.clientEmail = jwt.client_email;
  }

  validateJwt(jwt) {
    this.resetValidationMessages();
    if (!jwt.private_key || jwt.private_key.length === 0) {
      this.validationErrors.push('Private key field missing in JWT file.');
    }

    if (!jwt.token_uri || jwt.token_uri.length === 0) {
      this.validationErrors.push('Token URI field missing in JWT file.');
    }

    if (!jwt.client_email || jwt.client_email.length === 0) {
      this.validationErrors.push('Client Email field missing in JWT file.');
    }

    if (this.validationErrors.length === 0) {
      this.inputDataValid = true;
      return true;
    } else {
      return false;
    }
  }

  onUpload(json) {
    this.jsonText = '';
    if (this.validateJwt(json)) {
      this.save(json);
      this.displayProjects();
    }
  }

  onPasteJwt(e) {
    try {
      const json = JSON.parse(e.originalEvent.clipboardData.getData('text/plain') || this.jsonText);
      if (this.validateJwt(json)) {
        this.save(json);
        this.displayProjects();
      }
    } catch (error) {
      this.resetValidationMessages();
      this.validationErrors.push(`Invalid json: ${error.message}`);
    }
  }

  resetValidationMessages() {
    this.validationErrors = [];
    this.inputDataValid = false;
    this.jsonText = '';
  }

  async displayProjects() {
    if (this.projects.length === 0) {
      this.loadingProjects = true;
      const ds = await this.datasourceSrv.loadDatasource(this.current.name);
      try {
        this.projects = await ds.doRequest(`/cloudresourcemanager/v1/projects`);
      } catch (error) {
        console.log(error);
      }
    }
  }
}
