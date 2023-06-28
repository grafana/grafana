import { AuditRecordsState } from 'app/types';

export const getAuditRecords = (state: AuditRecordsState) => {
  return state.records;
};

export const getAuditRecordsSearchQuery = (state: AuditRecordsState) => state.searchQuery;
