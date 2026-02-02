import { t } from 'app/core/internationalization';

// Height of the search result item
export const SEARCH_ITEM_HEIGHT = 48;
export const SEARCH_ITEM_MARGIN = 4;
export const DEFAULT_SORT = { label: t('bmc.calc-fields.a-z', 'A-Z'), value: 'alpha-asc' };
export const SESSION_DS_INS_URL_KEY = 'calculatedfields.dsinstanceurl';
export const DEFAULT_CALC_FIELD = {
  name: '',
  formName: '',
  module: '',
  sqlQuery: '',
  Aggregation: false,
  rawQueryValidated: false,
};
