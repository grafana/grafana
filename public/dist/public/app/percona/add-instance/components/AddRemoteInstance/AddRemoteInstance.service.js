import { __awaiter } from "tslib";
import { Databases } from 'app/percona/shared/core';
import { apiManagement } from 'app/percona/shared/helpers/api';
import { InstanceTypesExtra } from '../../panel.types';
import { TrackingOptions, } from './AddRemoteInstance.types';
class AddRemoteInstanceService {
    static addMysql(body, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/MySQL/Add', body, false, token);
        });
    }
    static addPostgresql(body, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/PostgreSQL/Add', body, false, token);
        });
    }
    static addProxysql(body, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/ProxySQL/Add', body, false, token);
        });
    }
    static addHaproxy(body, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/HAProxy/Add', body, false, token);
        });
    }
    static addMongodb(body, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/MongoDB/Add', body, false, token);
        });
    }
    static addRDS(body, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/RDS/Add', body, false, token);
        });
    }
    static addAzure(body, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/azure/AzureDatabase/Add', body, false, token);
        });
    }
    static addExternal(body, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/External/Add', body, false, token);
        });
    }
    static addRemote(type, data, token) {
        switch (type) {
            case Databases.mongodb:
                return AddRemoteInstanceService.addMongodb(toPayload(data, '', type), token);
            case Databases.mysql:
                return AddRemoteInstanceService.addMysql(toPayload(data, '', type), token);
            case Databases.postgresql:
                return AddRemoteInstanceService.addPostgresql(toPayload(data, '', type), token);
            case Databases.proxysql:
                return AddRemoteInstanceService.addProxysql(toPayload(data, '', type), token);
            case Databases.haproxy:
                return AddRemoteInstanceService.addHaproxy(toExternalServicePayload(data), token);
            case InstanceTypesExtra.external:
                return AddRemoteInstanceService.addExternal(toExternalServicePayload(data), token);
            default:
                throw new Error('Unknown instance type');
        }
    }
}
export default AddRemoteInstanceService;
export const toPayload = (values, discoverName, type) => {
    const data = Object.assign({}, values);
    if (values.custom_labels) {
        data.custom_labels = data.custom_labels
            .split(/[\n\s]/)
            .filter(Boolean)
            .reduce((acc, val) => {
            const [key, value] = val.split(':');
            acc[key] = value;
            return acc;
        }, {});
    }
    if (!values.isAzure) {
        if (data.isRDS && data.tracking === TrackingOptions.pgStatements) {
            data.qan_postgresql_pgstatements = true;
        }
        else if (!data.isRDS && data.tracking === TrackingOptions.pgStatements) {
            data.qan_postgresql_pgstatements_agent = true;
        }
        else if (!data.isRDS && data.tracking === TrackingOptions.pgMonitor) {
            data.qan_postgresql_pgstatmonitor_agent = true;
        }
    }
    data.service_name = data.serviceName;
    delete data.serviceName;
    if (!data.service_name) {
        data.service_name = data.address;
    }
    if (!values.isAzure && data.add_node === undefined) {
        data.add_node = {
            node_name: data.service_name,
            node_type: 'REMOTE_NODE',
        };
    }
    if (values.isRDS && discoverName) {
        data.engine = discoverName;
    }
    if (values.isAzure && discoverName) {
        data.type = discoverName;
    }
    if (!data.pmm_agent_id) {
        // set default value for pmm agent id
        data.pmm_agent_id = 'pmm-server';
    }
    if (values.isRDS) {
        data.rds_exporter = true;
    }
    if (values.isAzure) {
        data.node_name = data.service_name;
        if (data.tracking === TrackingOptions.pgStatements || data.qan_mysql_perfschema) {
            data.qan = true;
        }
    }
    if (type === Databases.mongodb) {
        if (values.tls) {
            data.authentication_mechanism = 'MONGODB-X509';
        }
    }
    data.metrics_mode = 1;
    delete data.tracking;
    return data;
};
export const toExternalServicePayload = (values) => {
    const data = Object.assign({}, values);
    if (values.custom_labels) {
        data.custom_labels = data.custom_labels
            .split(/[\n\s]/)
            .filter(Boolean)
            .reduce((acc, val) => {
            const [key, value] = val.split(':');
            acc[key] = value;
            return acc;
        }, {});
    }
    delete data.tracking;
    data.service_name = data.serviceName;
    delete data.serviceName;
    if (!data.service_name) {
        data.service_name = data.address;
    }
    if (data.add_node === undefined) {
        data.add_node = {
            node_name: data.service_name,
            node_type: 'REMOTE_NODE',
        };
    }
    data.listen_port = data.port;
    delete data.port;
    data.metrics_mode = 1;
    return data;
};
//# sourceMappingURL=AddRemoteInstance.service.js.map