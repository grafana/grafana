import { CancelToken } from 'axios';
import { BackupLogs } from '../../Backup.types';

export interface ChunkedLogsViewerProps {
  onMore?: () => void;
  getLogChunks: (offset: number, limit: number, token?: CancelToken) => Promise<BackupLogs>;
}
