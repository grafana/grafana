import { createApi } from '@reduxjs/toolkit/query/react';

import { AddQueryTemplateCommand, DeleteQueryTemplateCommand, QueryTemplate } from '../types';

import { convertAddQueryTemplateCommandToDataQuerySpec, convertDataQueryResponseToQueryTemplates } from './mappers';
import { baseQuery } from './query';

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
  }),
  reducerPath: 'queryLibrary',
});
