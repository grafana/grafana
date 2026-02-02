import { CalcFieldItem, CalcFieldModule, SearchAction, SearchLayout } from '../../types';

import { TOGGLE_SECTION, FETCH_RESULTS, SEARCH_START, TOGGLE_CHECKED, LOAD_END } from './actionTypes';

export interface FieldsSearchState {
  results: CalcFieldModule[] | CalcFieldItem[];
  loading: boolean;
  selectedIndex: number;
  /** Used for first time page load */
  initialLoading: boolean;
}

export const fieldsSearchState: FieldsSearchState = {
  results: [],
  loading: true,
  initialLoading: true,
  selectedIndex: 0,
};

export const searchReducer = (state: FieldsSearchState, action: SearchAction) => {
  switch (action.type) {
    case SEARCH_START:
      if (!state.loading) {
        return { ...state, loading: true };
      }
      return state;
    case LOAD_END: {
      return { ...state, loading: false, initialLoading: false };
    }
    case FETCH_RESULTS: {
      const results = action.payload;
      return { ...state, results, loading: false, initialLoading: false };
    }
    case TOGGLE_SECTION: {
      const section = action.payload;
      return {
        ...state,
        results: (state.results as CalcFieldModule[]).map((result: CalcFieldModule) => {
          if (section['id'] === result['id']) {
            return { ...result, expanded: !result.expanded };
          }
          return result;
        }),
      };
    }
    case TOGGLE_CHECKED: {
      const { selectedItem, layout } = action.payload;
      const updatedResults =
        layout === SearchLayout.Module
          ? (state.results as CalcFieldModule[]).map((result: CalcFieldModule) => {
              const findIndex = result.items.findIndex(
                (item: CalcFieldItem) => item.fieldId && item.fieldId === selectedItem.fieldId
              );
              if (findIndex > -1) {
                result.items[findIndex] = {
                  ...result.items[findIndex],
                  checked: !result.items[findIndex].checked,
                };
              }
              return result;
            })
          : (state.results as CalcFieldItem[]).map((result: CalcFieldItem) => {
              if (result.fieldId && result.fieldId === selectedItem.fieldId) {
                result.checked = !result.checked;
              }
              return result;
            });
      return {
        ...state,
        results: updatedResults,
      };
    }
    default:
      return state;
  }
};
