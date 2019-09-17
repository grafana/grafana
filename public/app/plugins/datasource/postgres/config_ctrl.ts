import _ from 'lodash';
import {
  createChangeHandler,
  createResetHandler,
  PasswordFieldEnum,
} from '../../../features/datasources/utils/passwordHandlers';
import DatasourceSrv from 'app/features/plugins/datasource_srv';

export class PostgresConfigCtrl {
  static templateUrl = 'partials/config.html';

  current: any;
  datasourceSrv: any;
  showTimescaleDBHelp: boolean;
  onPasswordReset: ReturnType<typeof createResetHandler>;
  onPasswordChange: ReturnType<typeof createChangeHandler>;

  /** @ngInject */
  constructor($scope: any, datasourceSrv: DatasourceSrv) {
    this.datasourceSrv = datasourceSrv;
    this.current.jsonData.sslmode = this.current.jsonData.sslmode || 'verify-full';
    this.current.jsonData.postgresVersion = this.current.jsonData.postgresVersion || 903;
    this.showTimescaleDBHelp = false;
    this.autoDetectFeatures();
    this.onPasswordReset = createResetHandler(this, PasswordFieldEnum.Password);
    this.onPasswordChange = createChangeHandler(this, PasswordFieldEnum.Password);
  }

  autoDetectFeatures() {
    if (!this.current.id) {
      return;
    }

    this.datasourceSrv.loadDatasource(this.current.name).then((ds: any) => {
      return ds.getVersion().then((version: any) => {
        version = Number(version[0].text);

        // timescaledb is only available for 9.6+
        if (version >= 906) {
          ds.getTimescaleDBVersion().then((version: any) => {
            if (version.length === 1) {
              this.current.jsonData.timescaledb = true;
            }
          });
        }

        const major = Math.trunc(version / 100);
        const minor = version % 100;
        let name = String(major);
        if (version < 1000) {
          name = String(major) + '.' + String(minor);
        }
        if (!_.find(this.postgresVersions, (p: any) => p.value === version)) {
          this.postgresVersions.push({ name: name, value: version });
        }
        this.current.jsonData.postgresVersion = version;
      });
    });
  }

  toggleTimescaleDBHelp() {
    this.showTimescaleDBHelp = !this.showTimescaleDBHelp;
  }

  // the value portion is derived from postgres server_version_num/100
  postgresVersions = [
    { name: '9.3', value: 903 },
    { name: '9.4', value: 904 },
    { name: '9.5', value: 905 },
    { name: '9.6', value: 906 },
    { name: '10', value: 1000 },
  ];
}
