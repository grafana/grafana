import { createApi } from '@reduxjs/toolkit/query/react';

import { AddQueryTemplateCommand, DeleteQueryTemplateCommand, EditQueryTemplateCommand, QueryTemplate } from '../types';

import { convertAddQueryTemplateCommandToDataQuerySpec, convertDataQueryResponseToQueryTemplates } from './mappers';
import { baseQuery } from './query';

// Currently, we are loading all query templates
// Organizations can have maximum of 1000 query templates
export const QUERY_LIBRARY_GET_LIMIT = 1000;

export const queryLibraryApi = createApi({
  baseQuery,
  tagTypes: ['QueryTemplatesList'],
  endpoints: (builder) => ({
    allQueryTemplates: builder.query<QueryTemplate[], void>({
      query: () => ({
        url: `?limit=${QUERY_LIBRARY_GET_LIMIT}`,
      }),
      transformResponse: convertDataQueryResponseToQueryTemplates,
      providesTags: ['QueryTemplatesList'],
    }),
    addQueryTemplate: builder.mutation<QueryTemplate, AddQueryTemplateCommand>({
      query: (addQueryTemplateCommand) => ({
        method: 'POST',
        data: convertAddQueryTemplateCommandToDataQuerySpec(addQueryTemplateCommand),
      }),
      invalidatesTags: ['QueryTemplatesList'],
    }),
    deleteQueryTemplate: builder.mutation<void, DeleteQueryTemplateCommand>({
      query: ({ uid }) => ({
        url: `/${uid}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['QueryTemplatesList'],
    }),
    editQueryTemplate: builder.mutation<void, EditQueryTemplateCommand>({
      query: (editQueryTemplateCommand) => ({
        url: `/${editQueryTemplateCommand.uid}`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/merge-patch+json',
        },
        data: { spec: editQueryTemplateCommand.partialSpec },
      }),
      invalidatesTags: ['QueryTemplatesList'],
    }),
  }),
  reducerPath: 'queryLibrary',
});
