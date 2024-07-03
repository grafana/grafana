import { createApi } from '@reduxjs/toolkit/query/react';

import { AddQueryTemplateCommand, DeleteQueryTemplateCommand, EditQueryTemplateCommand, QueryTemplate } from '../types';

import { convertAddQueryTemplateCommandToDataQuerySpec, convertDataQueryResponseToQueryTemplates } from './mappers';
import { baseQuery } from './query';
import { DataQueryFullSpec, DataQueryPartialSpec } from './types';

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
    editQueryTemplate: builder.mutation<void, EditQueryTemplateCommand>({
      query: (editQueryTemplateCommand) => ({
        url: `${editQueryTemplateCommand.uid}`,
        method: 'PATCH',
        data: [{ op: 'replace', path: '/spec/title', value: editQueryTemplateCommand.partialSpec.title }],
      }),
      invalidatesTags: ['QueryTemplatesList'],
    }),
  }),
  reducerPath: 'queryLibrary',
});
