import { BackupLogChunk } from '../../Backup.types';

export const concatenateOlderLogs = (
  currentLogs: BackupLogChunk[],
  newLogs: BackupLogChunk[],
  limit: number,
  buffer: number
): BackupLogChunk[] => {
  if (newLogs.length) {
    if (newLogs.length > buffer) {
      newLogs = newLogs.slice(-buffer);
    }
    const totalNewLength = currentLogs.length + newLogs.length;

    if (totalNewLength > limit + buffer) {
      const subLogs = currentLogs.slice(0, limit);
      return [...newLogs, ...subLogs];
    } else {
      return [...newLogs, ...currentLogs];
    }
  }

  return currentLogs;
};

export const concatenateNewerLogs = (
  currentLogs: BackupLogChunk[],
  newLogs: BackupLogChunk[],
  limit: number,
  buffer: number
): BackupLogChunk[] => {
  if (newLogs.length) {
    if (newLogs.length > buffer) {
      newLogs = newLogs.slice(0, buffer);
    }

    const totalNewLength = newLogs.length + currentLogs.length;

    if (totalNewLength > limit + buffer) {
      const subLogs = currentLogs.slice(-limit);
      return [...subLogs, ...newLogs];
    } else {
      return [...currentLogs, ...newLogs];
    }
  }

  return currentLogs;
};
