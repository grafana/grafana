import { useMemo, useReducer } from 'react';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';

import {
  OnToggleChecked,
  SearchQuery,
  CalcFieldModule,
  CalcFieldItem,
  SearchLayout,
  FieldType,
  OnItemAction,
} from '../../types';
import { getCheckedItem } from '../../utils';
import { TOGGLE_CHECKED } from '../reducers/actionTypes';
import { searchReducer, fieldsSearchState, FieldsSearchState } from '../reducers/fieldSearch';

import { useSearch } from './useSearch';

export const useManageFields = (query: SearchQuery, queryDispatch: any) => {
  const reducer = useReducer(searchReducer, {
    ...fieldsSearchState,
  });

  const {
    state: { results, loading, initialLoading },
    onToggleSection,
    dispatch,
    onDeleteItems,
  } = useSearch<FieldsSearchState>(query, reducer, queryDispatch);

  const onToggleChecked: OnToggleChecked = (item) => {
    dispatch({ type: TOGGLE_CHECKED, payload: { selectedItem: item, layout: query.layout } });
  };

  const onItemAction: OnItemAction = (action: string) => {
    const checkedItem = getCheckedItem(results, query.layout);
    if (checkedItem) {
      const pathname = locationUtil.stripBaseFromUrl(`calculated-fields/${action}/${checkedItem.fieldId}`);
      locationService.push({ pathname });
    }
  };

  const showActions = useMemo(() => {
    // below if condition for RBAC
    if (!contextSrv.hasPermission('calculated.fields:create')) {
      return {
        showDeleteAction: false,
        showEditAction: false,
        showCloneAction: false,
      };
    }
    const checkedItem: CalcFieldItem[] = [];
    let allowedEditAndDelete = true;
    query.layout === SearchLayout.Module
      ? (results as CalcFieldModule[]).map((result: CalcFieldModule) => {
          return result.items?.map((item: CalcFieldItem) => {
            if (item.checked) {
              checkedItem.push(item);
              allowedEditAndDelete = item.field_type === FieldType.OOTB ? false : allowedEditAndDelete;
            }
          });
        })
      : (results as CalcFieldItem[]).map((item: CalcFieldItem) => {
          if (item.checked) {
            checkedItem.push(item);
            allowedEditAndDelete = item.field_type === FieldType.OOTB ? false : allowedEditAndDelete;
          }
        });

    return {
      showDeleteAction: allowedEditAndDelete && checkedItem.length,
      showEditAction: allowedEditAndDelete && checkedItem.length === 1,
      showCloneAction: checkedItem.length === 1,
    };
  }, [results, query.layout]);

  const typeOptions = useMemo(() => {
    const options = new Set<string>();
    if (query.layout === SearchLayout.Module) {
      (results as CalcFieldModule[]).map((result: CalcFieldModule) => {
        result.items?.map((item: CalcFieldItem) => {
          return item.field_type ? options.add(item.field_type) : null;
        });
      });
    } else {
      (results as CalcFieldItem[]).map((item: CalcFieldItem) => {
        return item.field_type ? options.add(item.field_type) : null;
      });
    }
    return [...options];
  }, [results, query.layout]);

  const noFolders = results.length === 0 && !loading && !initialLoading;

  return {
    results,
    loading,
    initialLoading,
    showActions,
    onToggleSection,
    onToggleChecked,
    onDeleteItems,
    onItemAction,
    noFolders,
    typeOptions,
  };
};
