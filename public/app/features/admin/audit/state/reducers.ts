import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AuditRecord, AuditRecordsState } from 'app/types';

export const initialState: AuditRecordsState = {
  records: [],
  searchQuery: '',
  page: 0,
  perPage: 30,
  totalPages: 1,
  isLoading: false,
};

export interface AuditRecordsFetchResult {
  records: AuditRecord[];
  perPage: number;
  page: number;
  totalCount: number;
}

const auditRecordsSlice = createSlice({
  name: 'auditRecords',
  initialState,
  reducers: {
    auditRecordsLoaded: (state, action: PayloadAction<AuditRecordsFetchResult>): AuditRecordsState => {
      const { totalCount, perPage, page, records } = action.payload;
      const totalPages = Math.ceil(totalCount / perPage);

      return {
        ...state,
        isLoading: true,
        records: records,
        perPage,
        page,
        totalPages,
      };
    },
    setSearchQuery: (state, action: PayloadAction<string>): AuditRecordsState => {
      return { ...state, searchQuery: action.payload };
    },
    searchQueryChanged: (state, action: PayloadAction<string>): AuditRecordsState => {
      // reset searchPage otherwise search results won't appear
      return { ...state, searchQuery: action.payload, page: initialState.page };
    },
    setAuditRecordsSearchPage: (state, action: PayloadAction<number>): AuditRecordsState => {
      return { ...state, page: action.payload };
    },
    pageChanged: (state, action: PayloadAction<number>) => ({
      ...state,
      page: action.payload,
    }),
    auditRecordsFetchBegin: (state) => {
      return { ...state, isLoading: true };
    },
    auditRecordsFetchEnd: (state) => {
      return { ...state, isLoading: false };
    },
  },
});

export const {
  searchQueryChanged,
  setAuditRecordsSearchPage,
  auditRecordsLoaded,
  auditRecordsFetchBegin,
  auditRecordsFetchEnd,
  pageChanged,
} = auditRecordsSlice.actions;

export const auditRecordsReducer = auditRecordsSlice.reducer;

export default {
  records: auditRecordsReducer,
};
