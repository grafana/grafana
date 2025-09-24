import { parseListOptionsSelector } from '../../../../features/apiserver/client';
import { ListOptions } from '../../../../features/apiserver/types';
import { ListRepositoryApiArg } from '../v0alpha1/endpoints.gen';

type ListParams = Omit<ListRepositoryApiArg, 'fieldSelector' | 'labelSelector'> &
  Pick<ListOptions, 'labelSelector' | 'fieldSelector'>;

/**
 * A helper function to remove the watch argument from the queryArg and convert field- and labelSelectors to strings
 */
export function getListParams(queryArg: ListParams) {
  if (!queryArg) {
    return {};
  }
  const { fieldSelector, labelSelector, watch, ...params } = queryArg;
  return {
    fieldSelector: fieldSelector ? parseListOptionsSelector(fieldSelector) : undefined,
    labelSelector: labelSelector ? parseListOptionsSelector(labelSelector) : undefined,
    ...params,
  };
}
