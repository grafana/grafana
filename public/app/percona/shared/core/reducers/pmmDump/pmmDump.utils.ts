import { PMMDumpServices, ExportDatasetService } from 'app/percona/pmm-dump/PmmDump.types';
import { PmmDump, ExportDatasetProps } from 'app/percona/shared/core/reducers/pmmDump/pmmDump.types';

export const mapDumps = (dumps: PmmDump[]): PMMDumpServices[] =>
  dumps.map((dump) => ({
    dumpId: dump.dump_id,
    status: dump.status,
    serviceNames: dump.service_names,
    startTime: dump.start_time,
    endTime: dump.end_time,
    createdAt: dump.created_at,
  }));

export const mapExportData = (data: ExportDatasetService): ExportDatasetProps => ({
  service_names: data.serviceNames,
  start_time: data.startTime,
  end_time: data.endTime,
  ignore_load: data.ignoreLoad,
  export_qan: data.exportQan,
});
