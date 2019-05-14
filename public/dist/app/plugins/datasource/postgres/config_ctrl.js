import _ from 'lodash';
var PostgresConfigCtrl = /** @class */ (function () {
    /** @ngInject */
    function PostgresConfigCtrl($scope, datasourceSrv) {
        // the value portion is derived from postgres server_version_num/100
        this.postgresVersions = [
            { name: '9.3', value: 903 },
            { name: '9.4', value: 904 },
            { name: '9.5', value: 905 },
            { name: '9.6', value: 906 },
            { name: '10', value: 1000 },
        ];
        this.datasourceSrv = datasourceSrv;
        this.current.jsonData.sslmode = this.current.jsonData.sslmode || 'verify-full';
        this.current.jsonData.postgresVersion = this.current.jsonData.postgresVersion || 903;
        this.showTimescaleDBHelp = false;
        this.autoDetectFeatures();
    }
    PostgresConfigCtrl.prototype.autoDetectFeatures = function () {
        var _this = this;
        if (!this.current.id) {
            return;
        }
        this.datasourceSrv.loadDatasource(this.current.name).then(function (ds) {
            return ds.getVersion().then(function (version) {
                version = Number(version[0].text);
                // timescaledb is only available for 9.6+
                if (version >= 906) {
                    ds.getTimescaleDBVersion().then(function (version) {
                        if (version.length === 1) {
                            _this.current.jsonData.timescaledb = true;
                        }
                    });
                }
                var major = Math.trunc(version / 100);
                var minor = version % 100;
                var name = String(major);
                if (version < 1000) {
                    name = String(major) + '.' + String(minor);
                }
                if (!_.find(_this.postgresVersions, function (p) { return p.value === version; })) {
                    _this.postgresVersions.push({ name: name, value: version });
                }
                _this.current.jsonData.postgresVersion = version;
            });
        });
    };
    PostgresConfigCtrl.prototype.toggleTimescaleDBHelp = function () {
        this.showTimescaleDBHelp = !this.showTimescaleDBHelp;
    };
    PostgresConfigCtrl.templateUrl = 'partials/config.html';
    return PostgresConfigCtrl;
}());
export { PostgresConfigCtrl };
//# sourceMappingURL=config_ctrl.js.map