import { CancelToken } from 'axios';

import { DumpStatus, PMMDumpServices } from 'app/percona/pmm-dump/PmmDump.types';

export interface PmmDumpState {
  isLoading: boolean;
  isDownloading: boolean;
  isDeleting: boolean;
  dumps: PMMDumpServices[];
}

export interface PmmDump {
  dump_id: string;
  status: DumpStatus;
  service_names: string[];
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface ExportDatasetProps {
  service_names: Array<string | undefined>;
  start_time: string;
  end_time: string;
  ignore_load: boolean;
  export_qan: boolean;
}

export interface ExportResponse {
  dump_id: string;
}

export interface LogsActionProps {
  artifactId: string;
  startingChunk: number;
  offset: number;
  token: CancelToken | undefined;
}
