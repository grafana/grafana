import { regexifyLabelValuesQueryString } from '../../parsingUtils';
import { QueryBuilderLabelFilter } from '../../shared/types';

export const formatPrometheusLabelFiltersToString = (
  queryString: string,
  labelsFilters: QueryBuilderLabelFilter[] | undefined
): string => {
  const filterArray = labelsFilters ? formatPrometheusLabelFilters(labelsFilters) : [];

  return `{__name__=~".*${queryString}"${filterArray ? filterArray.join('') : ''}}`;
};

export const formatPrometheusLabelFilters = (labelsFilters: QueryBuilderLabelFilter[]): string[] => {
  return labelsFilters.map((label) => {
    return `,${label.label}="${label.value}"`;
  });
};

/**
 * Reformat the query string and label filters to return all valid results for current query editor state
 */
export const formatKeyValueStrings = (query: string, labelsFilters?: QueryBuilderLabelFilter[]): string => {
  const queryString = regexifyLabelValuesQueryString(query);

  return formatPrometheusLabelFiltersToString(queryString, labelsFilters);
};
