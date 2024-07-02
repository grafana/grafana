import { createApi } from '@reduxjs/toolkit/query/react';

import { AddQueryTemplateCommand, DeleteQueryTemplateCommand, QueryTemplate } from '../types';

import { convertAddQueryTemplateCommandToDataQuerySpec, convertDataQueryResponseToQueryTemplates } from './mappers';
import { baseQuery } from './query';
import { DataQuerySpec } from './types';

export const queryLibraryApi = createApi({
  baseQuery,
  tagTypes: ['QueryTemplatesList'],
  endpoints: (builder) => ({
    allQueryTemplates: builder.query<QueryTemplate[], void>({
      query: () => ({}),
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
        url: `${uid}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['QueryTemplatesList'],
    }),
    editQueryTemplate: builder.mutation<void, DataQuerySpec>({
      query: (editQueryTemplateCommand) => ({
        url: `${editQueryTemplateCommand.metadata.name}`,
        method: 'PUT',
        data: editQueryTemplateCommand,
      }),
      invalidatesTags: ['QueryTemplatesList'],
    }),
  }),
  reducerPath: 'queryLibrary',
});
