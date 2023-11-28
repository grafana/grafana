import { __awaiter } from "tslib";
import { useState } from 'react';
import { useDeepCompareEffect } from 'react-use';
import { updateDatasourcePluginJsonDataOption, updateDatasourcePluginOption, } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { PostgresDatasource } from '../datasource';
import { PostgresTLSModes } from '../types';
import { postgresVersions } from './ConfigurationEditor';
export function useAutoDetectFeatures({ props, setVersionOptions }) {
    const [saved, setSaved] = useState(false);
    const { options, onOptionsChange } = props;
    useDeepCompareEffect(() => {
        const getVersion = () => __awaiter(this, void 0, void 0, function* () {
            if (!saved) {
                // We need to save the datasource before we can get the version so we can query the database with the options we have.
                const result = yield getBackendSrv().put(`/api/datasources/${options.id}`, options);
                setSaved(true);
                // This is needed or else we get an error when we try to save the datasource.
                updateDatasourcePluginOption({ options, onOptionsChange }, 'version', result.datasource.version);
            }
            else {
                const datasource = yield getDataSourceSrv().get(options.name);
                if (datasource instanceof PostgresDatasource) {
                    const version = yield datasource.getVersion();
                    const versionNumber = parseInt(version, 10);
                    // timescaledb is only available for 9.6+
                    if (versionNumber >= 906 && !options.jsonData.timescaledb) {
                        const timescaledbVersion = yield datasource.getTimescaleDBVersion();
                        if (timescaledbVersion) {
                            updateDatasourcePluginJsonDataOption({ options, onOptionsChange }, 'timescaledb', true);
                        }
                    }
                    const major = Math.trunc(versionNumber / 100);
                    const minor = versionNumber % 100;
                    let name = String(major);
                    if (versionNumber < 1000) {
                        name = String(major) + '.' + String(minor);
                    }
                    if (!postgresVersions.find((p) => p.value === versionNumber)) {
                        setVersionOptions((prev) => [...prev, { label: name, value: versionNumber }]);
                    }
                    if (options.jsonData.postgresVersion === undefined || options.jsonData.postgresVersion !== versionNumber) {
                        updateDatasourcePluginJsonDataOption({ options, onOptionsChange }, 'postgresVersion', versionNumber);
                    }
                }
            }
        });
        // This logic is only going to run when we create a new datasource
        if (isValidConfig(options)) {
            getVersion();
        }
    }, [options, saved, setVersionOptions]);
}
function isValidConfig(options) {
    var _a, _b;
    return (options.url &&
        options.jsonData.database &&
        options.user &&
        (((_a = options.secureJsonData) === null || _a === void 0 ? void 0 : _a.password) || ((_b = options.secureJsonFields) === null || _b === void 0 ? void 0 : _b.password)) &&
        (options.jsonData.sslmode === PostgresTLSModes.disable ||
            (options.jsonData.sslCertFile && options.jsonData.sslKeyFile && options.jsonData.sslRootCertFile)) &&
        !options.jsonData.postgresVersion &&
        !options.readOnly);
}
//# sourceMappingURL=useAutoDetectFeatures.js.map