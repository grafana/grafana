import { generatedAPI } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { t } from '@grafana/i18n';
import { handleError } from 'app/api/utils';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';

const variableListTag = { type: 'Variable' as const, id: 'LIST' };

export const dashboardAPIv2beta1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    getVariable: {
      providesTags: (result, error, arg) => (result ? [{ type: 'Variable', id: arg.name }] : []),
    },
    listVariable: {
      providesTags: (result) =>
        result
          ? [
              variableListTag,
              ...result.items
                .map((variable) => ({ type: 'Variable' as const, id: variable.metadata?.name }))
                .filter((tag) => tag.id != null),
            ]
          : [variableListTag],
    },
    createVariable: {
      invalidatesTags: (_result, error) => (error ? [] : [variableListTag]),
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            generatedAPI.util.updateQueryData('listVariable', {}, (list) => {
              list.items = [...(list.items || []), data];
            })
          );
          dispatch(
            notifyApp(
              createSuccessNotification(
                t('global-variables.details.create-success', 'Global variable successfully created')
              )
            )
          );
        } catch (e) {
          handleError(e, dispatch, t('global-variables.details.create-error', 'Failed to create global variable'));
        }
      },
    },
    updateVariable: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) => ({
          ...originalQuery(requestOptions),
          headers: {
            'Content-Type': 'application/merge-patch+json',
          },
        });
      }
      endpointDefinition.invalidatesTags = (_result, error, arg) =>
        error ? [] : [{ type: 'Variable', id: arg.name }, variableListTag];
      endpointDefinition.onQueryStarted = async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(
            notifyApp(
              createSuccessNotification(
                t('global-variables.details.update-success', 'Global variable successfully updated')
              )
            )
          );
        } catch (e) {
          handleError(e, dispatch, t('global-variables.details.update-error', 'Failed to update global variable'));
        }
      };
    },
    replaceVariable: {
      invalidatesTags: (_result, error, arg) => (error ? [] : [{ type: 'Variable', id: arg.name }, variableListTag]),
    },
    deleteVariable: {
      invalidatesTags: (_result, error) => (error ? [] : [variableListTag]),
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(
            notifyApp(
              createSuccessNotification(
                t('global-variables.details.delete-success', 'Global variable successfully deleted')
              )
            )
          );
        } catch (e) {
          handleError(e, dispatch, t('global-variables.details.delete-error', 'Failed to delete global variable'));
        }
      },
    },
  },
});

export const {
  useListVariableQuery,
  useLazyListVariableQuery,
  useGetVariableQuery,
  useCreateVariableMutation,
  useUpdateVariableMutation,
  useDeleteVariableMutation,
  useReplaceVariableMutation,
} = dashboardAPIv2beta1;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export type {
  Variable,
  VariableList,
  VariableSpec,
  ListVariableApiResponse,
  CreateVariableApiArg,
  UpdateVariableApiArg,
} from '@grafana/api-clients/rtkq/dashboard/v2beta1';
