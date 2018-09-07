export class StackdriverConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/stackdriver/partials/config.html';
  datasourceSrv: any;
  current: any;
  jsonText: string;
  validationErrors: string[] = [];
  inputDataValid: boolean;
  defaultProject: string;
  projectsError: string;
  projects: any[];
  loadingProjects: boolean;

  /** @ngInject */
  constructor(private $scope, datasourceSrv) {
    this.datasourceSrv = datasourceSrv;
    this.current.jsonData = this.current.jsonData || {};
    this.current.secureJsonData = this.current.secureJsonData || {};
    this.current.secureJsonFields = this.current.secureJsonFields || {};
    this.defaultProject = this.current.jsonData.defaultProject;
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
    this.loadingProjects = false;
    this.projectsError = '';

    this.current.jsonData = {};
    this.current.secureJsonData = {};
    this.current.secureJsonFields = {};
  }

  async displayProjects() {
    if (this.projects.length === 0) {
      try {
        this.loadingProjects = true;
        const ds = await this.datasourceSrv.loadDatasource(this.current.name);
        this.projects = await ds.getProjects();
        this.$scope.$apply(() => {
          if (this.projects.length > 0) {
            this.current.jsonData.defaultProject = this.current.jsonData.defaultProject || this.projects[0].id;
          }
        });
      } catch (error) {
        let message = 'Projects cannot be fetched: ';
        message += error.statusText ? error.statusText + ': ' : '';
        if (error && error.data && error.data.error && error.data.error.message) {
          if (error.data.error.code === 403) {
            message += `
            A list of projects could not be fetched from the Google Cloud Resource Manager API.
            You might need to enable it first:
            https://console.developers.google.com/apis/library/cloudresourcemanager.googleapis.com`;
          } else {
            message += error.data.error.code + '. ' + error.data.error.message;
          }
        } else {
          message += 'Cannot connect to Stackdriver API';
        }
        this.$scope.$apply(() => (this.projectsError = message));
      } finally {
        this.$scope.$apply(() => (this.loadingProjects = false));
      }
    }
  }
}
