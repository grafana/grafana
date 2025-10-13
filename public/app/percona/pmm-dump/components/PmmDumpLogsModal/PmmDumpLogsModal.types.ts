import { CancelToken } from 'axios';

import { DumpLogs } from 'app/percona/pmm-dump/PmmDump.types';

export interface PmmDumpModalProps {
  isVisible: boolean;
  title: string;
  onClose: () => void;
  getLogChunks: (offset: number, limit: number, token?: CancelToken) => Promise<DumpLogs>;
}
