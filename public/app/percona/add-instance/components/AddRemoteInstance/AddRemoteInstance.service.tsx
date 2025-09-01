import { CancelToken } from 'axios';

import { PMM_SERVER_NODE_AGENT_ID } from 'app/percona/add-instance/components/AddRemoteInstance/FormParts/NodesAgents/NodesAgents.constants';
import { Databases } from 'app/percona/shared/core';
import { apiManagement } from 'app/percona/shared/helpers/api';
import { CustomLabelsUtils } from 'app/percona/shared/helpers/customLabels';

import { InstanceTypesExtra, InstanceAvailableType } from '../../panel.types';

import {
  ExternalPayload,
  RemoteInstancePayload,
  TrackingOptions,
  ProxySQLInstanceResponse,
  PostgreSQLInstanceResponse,
  MySQLInstanceResponse,
  AddHaProxyResponse,
  AddMongoDbResponse,
  AddRDSResponse,
  AddExternalResponse,
  ErrorResponse,
  RDSPayload,
  MSAzurePayload,
  MySQLPayload,
  PostgreSQLPayload,
  HaProxyPayload,
  ProxySQLPayload,
  MongoDBPayload,
  AddServicePayload,
} from './AddRemoteInstance.types';

const BASE_URL = '/services';

class AddRemoteInstanceService {
  static async addMysql(body: MySQLPayload, token?: CancelToken) {
    return apiManagement.post<MySQLInstanceResponse | ErrorResponse, AddServicePayload>(
      BASE_URL,
      { mysql: body },
      false,
      token
    );
  }

  static async addPostgresql(body: PostgreSQLPayload, token?: CancelToken) {
    return apiManagement.post<PostgreSQLInstanceResponse | ErrorResponse, AddServicePayload>(
      BASE_URL,
      { postgresql: body },
      false,
      token
    );
  }

  static async addProxysql(body: ProxySQLPayload, token?: CancelToken) {
    return apiManagement.post<ProxySQLInstanceResponse | ErrorResponse, AddServicePayload>(
      BASE_URL,
      { proxysql: body },
      false,
      token
    );
  }

  static async addHaproxy(body: HaProxyPayload, token?: CancelToken) {
    return apiManagement.post<AddHaProxyResponse | ErrorResponse, AddServicePayload>(
      BASE_URL,
      { haproxy: body },
      false,
      token
    );
  }

  static async addMongodb(body: MongoDBPayload, token?: CancelToken) {
    return apiManagement.post<AddMongoDbResponse | ErrorResponse, AddServicePayload>(
      BASE_URL,
      { mongodb: body },
      false,
      token
    );
  }

  static async addRDS(body: RDSPayload, token?: CancelToken) {
    return apiManagement.post<AddRDSResponse | ErrorResponse, AddServicePayload>(BASE_URL, { rds: body }, false, token);
  }

  static async addAzure(body: MSAzurePayload, token?: CancelToken) {
    return apiManagement.post<{} | ErrorResponse, RemoteInstancePayload>(`${BASE_URL}/azure`, body, false, token);
  }

  static async addExternal(body: ExternalPayload, token?: CancelToken) {
    return apiManagement.post<AddExternalResponse, AddServicePayload>(BASE_URL, { external: body }, false, token);
  }

  static addRemote(type: InstanceAvailableType, data: RemoteInstancePayload, token?: CancelToken) {
    switch (type) {
      case Databases.mongodb:
        return AddRemoteInstanceService.addMongodb(toPayload(data, '', type) as MongoDBPayload, token);
      case Databases.mysql:
        return AddRemoteInstanceService.addMysql(toPayload(data, '', type) as MySQLPayload, token);
      case Databases.postgresql:
        return AddRemoteInstanceService.addPostgresql(toPayload(data, '', type) as PostgreSQLPayload, token);
      case Databases.proxysql:
        return AddRemoteInstanceService.addProxysql(toPayload(data, '', type) as ProxySQLPayload, token);
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

export const toPayload = (values: any, discoverName?: string, type?: InstanceAvailableType): RemoteInstancePayload => {
  const data = { ...values };

  if (values.custom_labels) {
    data.custom_labels = CustomLabelsUtils.toPayload(data.custom_labels);
  }

  if (values.extra_dsn_params) {
    data.extra_dsn_params = CustomLabelsUtils.toPayload(data.extra_dsn_params);
  }

  if (!values.isAzure) {
    if (data.isRDS && data.tracking === TrackingOptions.pgStatements) {
      data.qan_postgresql_pgstatements = true;
    } else if (!data.isRDS && data.tracking === TrackingOptions.pgStatements) {
      data.qan_postgresql_pgstatements_agent = true;
    } else if (!data.isRDS && data.tracking === TrackingOptions.pgMonitor) {
      data.qan_postgresql_pgstatmonitor_agent = true;
    }
  }

  data.service_name = data.serviceName;
  delete data.serviceName;

  if (!data.service_name) {
    data.service_name = data.address;
  }

  if (data.address === '127.0.0.1' || data.address === 'localhost') {
    data.node_id = data.node.value;
  } else if (!values.isAzure && data.add_node === undefined) {
    data.add_node = {
      node_type: 'NODE_TYPE_REMOTE_NODE',
    };
  }

  data.node_name = data.service_name;

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

  data.pmm_agent_id = values.pmm_agent_id.value;

  if (data.pmm_agent_id === PMM_SERVER_NODE_AGENT_ID) {
    data.metrics_mode = 1;
  } else {
    data.metrics_mode = 2;
  }
  delete data.tracking;
  delete data.node;

  return data;
};

export const toExternalServicePayload = (values: any): ExternalPayload => {
  const data = { ...values };

  if (values.custom_labels) {
    data.custom_labels = data.custom_labels
      .split(/[\n\s]/)
      .filter(Boolean)
      .reduce((acc: any, val: string) => {
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
      node_type: 'NODE_TYPE_REMOTE_NODE',
    };
  }

  data.listen_port = data.port;
  delete data.port;

  data.metrics_mode = 1;

  return data;
};
