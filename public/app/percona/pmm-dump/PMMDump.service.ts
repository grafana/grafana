import { CancelToken } from 'axios';

import { PmmDump, ExportDatasetProps } from 'app/percona/shared/core/reducers/pmmDump/pmmDump.types';
import { api } from 'app/percona/shared/helpers/api';

import {
  DumpLogs,
  DumpLogResponse,
  SendToSupportRequestBody,
  DeleteDump,
  PmmDumpResponse,
  ExportResponse,
} from './PmmDump.types';

const BASE_URL = '/v1/management/dump/Dumps';
const link = document.createElement('a');

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const PMMDumpService = {
  async getLogs(artifactId: string, offset: number, limit: number, token?: CancelToken): Promise<DumpLogs> {
    const { logs = [], end } = await api.post<DumpLogResponse, Object>(
      `${BASE_URL}/GetLogs`,
      {
        dump_id: artifactId,
        offset,
        limit,
      },
      false,
      token
    );
    return {
      logs: logs.map(({ chunk_id = 0, data, time }) => ({ id: chunk_id, data, time })),
      end,
    };
  },
  async list(): Promise<PmmDump[]> {
    const response = await api.post<PmmDumpResponse, void>(`${BASE_URL}/List`, undefined);
    return response.dumps || [];
  },
  async delete(dumpIds: string[]) {
    await api.post<void, DeleteDump>(`${BASE_URL}/Delete`, { dump_ids: dumpIds });
  },
  async downloadAll(dumpIds: string[], index = 0): Promise<void> {
    for (let i = index; i < dumpIds.length; i++) {
      await this.download(dumpIds, i);
    }
  },
  async download(dumpIds: string[], index: number): Promise<void> {
    return new Promise<void>(async (resolve) => {
      const dumpId = dumpIds[index];

      link.setAttribute('href', `${window.location.origin}/dump/${dumpId}.tar.gz`);
      link.setAttribute('download', `${dumpId}.tar.gz`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await delay(900);
      resolve();
    });
  },
  async sendToSupport(body: SendToSupportRequestBody) {
    await api.post<void, DeleteDump>(`${BASE_URL}/Upload`, body, true);
  },
  async trigger(body: ExportDatasetProps, token?: CancelToken): Promise<string> {
    const res = await api.post<ExportResponse, ExportDatasetProps>(`${BASE_URL}/Start`, body, false, token);
    return res.dump_id;
  },
};
