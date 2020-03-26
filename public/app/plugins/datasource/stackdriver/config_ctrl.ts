import DatasourceSrv from 'app/features/plugins/datasource_srv';
import { AuthType, authTypes } from './types';

export interface JWT {
  private_key: string;
  token_uri: string;
  client_email: string;
  project_id: string;
}

export class StackdriverConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/stackdriver/partials/config.html';
  datasourceSrv: DatasourceSrv;
  current: any;
  meta: any;
  jsonText: string;
  validationErrors: string[] = [];
  inputDataValid: boolean;
  authenticationTypes: Array<{ key: AuthType; value: string }>;
  defaultAuthenticationType: string;
  name: string;

  /** @ngInject */
  constructor(datasourceSrv: DatasourceSrv) {
    this.defaultAuthenticationType = AuthType.JWT;
    this.datasourceSrv = datasourceSrv;
    this.name = this.meta.name;
    this.current.jsonData = this.current.jsonData || {};
    this.current.jsonData.authenticationType = this.current.jsonData.authenticationType
      ? this.current.jsonData.authenticationType
      : this.defaultAuthenticationType;
    this.current.secureJsonData = this.current.secureJsonData || {};
    this.current.secureJsonFields = this.current.secureJsonFields || {};
    this.authenticationTypes = authTypes;
  }

  save(jwt: JWT) {
    this.current.secureJsonData.privateKey = jwt.private_key;
    this.current.jsonData.tokenUri = jwt.token_uri;
    this.current.jsonData.clientEmail = jwt.client_email;
    this.current.jsonData.defaultProject = jwt.project_id;
  }

  validateJwt(jwt: JWT) {
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

    if (!jwt.project_id || jwt.project_id.length === 0) {
      this.validationErrors.push('Project Id field missing in JWT file.');
    }

    if (this.validationErrors.length === 0) {
      this.inputDataValid = true;
      return true;
    }

    return false;
  }

  onUpload(json: JWT) {
    this.jsonText = '';
    if (this.validateJwt(json)) {
      this.save(json);
    }
  }

  onPasteJwt(e: any) {
    try {
      const json = JSON.parse(e.originalEvent.clipboardData.getData('text/plain') || this.jsonText);
      if (this.validateJwt(json)) {
        this.save(json);
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

    this.current.jsonData = Object.assign({}, { authenticationType: this.current.jsonData.authenticationType });
    this.current.secureJsonData = {};
    this.current.secureJsonFields = {};
  }
}
