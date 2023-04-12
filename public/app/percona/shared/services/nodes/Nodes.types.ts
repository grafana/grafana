export interface NodePayload {
  node_id: string;
  node_name: string;
  address: string;
  node_model?: string;
  region?: string;
  az?: string;
  custom_labels?: Record<string, string>;
}

export interface GenericNodePayload extends NodePayload {
  distro?: string;
}

export interface ContainerNodePayload extends NodePayload {
  machine_id?: string;
  container_id?: string;
  container_name?: string;
}

export type RemoteNodePayload = NodePayload;
export type RemoteRDSNodePayload = NodePayload;
export type RemoteAzureNodePayload = NodePayload;

export enum NodeType {
  generic = 'generic',
  container = 'container',
  remote = 'remote',
  remoteRDS = 'remote_rds',
  remoteAzureDB = 'remote_azure_database',
}

export interface NodeListPayload {
  [NodeType.generic]?: GenericNodePayload[];
  [NodeType.container]?: ContainerNodePayload[];
  [NodeType.remote]?: RemoteNodePayload[];
  [NodeType.remoteRDS]?: RemoteRDSNodePayload[];
  [NodeType.remoteAzureDB]?: RemoteAzureNodePayload[];
}

export type Node = {
  type: NodeType;
  params: DbNode;
};

export interface DbNode {
  nodeId: string;
  nodeName: string;
  address: string;
  az?: string;
  customLabels?: Record<string, string>;
}

export type RemoteDbNode = Node;
export type RemoteDbRDSNode = Node;
export type RemoteDbAzureNode = Node;
