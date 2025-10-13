import { PmmDump } from 'app/percona/shared/core/reducers/pmmDump/pmmDump.types';

export enum DumpStatus {
  DUMP_STATUS_INVALID = 'DUMP_STATUS_INVALID',
  DUMP_STATUS_IN_PROGRESS = 'DUMP_STATUS_IN_PROGRESS',
  DUMP_STATUS_SUCCESS = 'DUMP_STATUS_SUCCESS',
  DUMP_STATUS_ERROR = 'DUMP_STATUS_ERROR',
}

export const DumpStatusText = {
  [DumpStatus.DUMP_STATUS_INVALID]: 'Invalid',
  [DumpStatus.DUMP_STATUS_IN_PROGRESS]: 'Pending',
  [DumpStatus.DUMP_STATUS_SUCCESS]: 'Success',
  [DumpStatus.DUMP_STATUS_ERROR]: 'Error',
};

export interface PMMDumpServices {
  dumpId: string;
  status: DumpStatus;
  createdAt: string;
  startTime: string;
  endTime: string;
  serviceNames: string[];
  timeRange?: string;
}

export const DumpStatusColor = {
  [DumpStatus.DUMP_STATUS_INVALID]: 'red',
  [DumpStatus.DUMP_STATUS_IN_PROGRESS]: 'orange',
  [DumpStatus.DUMP_STATUS_SUCCESS]: 'green',
  [DumpStatus.DUMP_STATUS_ERROR]: 'red',
};

export interface SendToSupportRequestBody {
  sftp_parameters: {
    user: string;
    address: string;
    password: string;
    directory?: string;
  };
  dump_ids: string[];
}

export interface SendToSupportForm {
  user: string;
  address: string;
  password: string;
  dumpIds: string[];
  directory?: string;
}

export interface RawDumpLog {
  chunk_id: number;
  data: string;
  time: string;
}

export interface DumpLogResponse {
  logs: RawDumpLog[];
  end: boolean;
}

export interface DumpLogChunk extends Omit<RawDumpLog, 'chunk_id'> {
  id: number;
}

export interface DumpLogs {
  logs: DumpLogChunk[];
  end: boolean;
}

export interface PmmDumpResponse {
  dumps: PmmDump[];
}

export interface DeleteDump {
  dump_ids: string[];
}

export interface Node {
  node_id: string;
  node_name: string;
  address: string;
  machine_id?: string;
  distro?: string;
  node_model: string;
  region: string;
  az: string;
  custom_labels: {
    additionalProp1: string;
    additionalProp2: string;
    additionalProp3: string;
  };
}

export interface NodeTypes {
  generic: Node;
  container: Node;
  remote: Node;
  remote_rds: Node;
  remote_azure_database: Node;
}

export interface ExportResponse {
  dump_id: string;
}

export interface ExportDatasetService {
  serviceNames: Array<string | undefined>;
  startTime: string;
  endTime: string;
  ignoreLoad: boolean;
  exportQan: boolean;
}
