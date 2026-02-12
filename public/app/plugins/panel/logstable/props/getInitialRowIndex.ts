import { LogsFrame } from 'app/features/logs/logsFrame';

export const getInitialRowIndex = (permalinkedLogId: string | undefined, logsFrame: LogsFrame | null) => {
  if (!permalinkedLogId || !logsFrame) {
    return undefined;
  }
  const initialRowIndex = logsFrame.idField?.values.findIndex((id) => id === permalinkedLogId);
  return initialRowIndex !== undefined && initialRowIndex > -1 ? initialRowIndex : undefined;
};
