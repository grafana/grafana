import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FilterInput, useStyles2 } from '@grafana/ui';

import { TreeNode } from './types';

export interface ScopesTreeSearchProps {
  anyChildExpanded: boolean;
  searchArea: string;
  treeNode: TreeNode;
  onNodeUpdate: (scopeNodeId: string, expanded: boolean, query: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  'aria-controls': string;
  'aria-activedescendant'?: string;
}

export function ScopesTreeSearch({
  anyChildExpanded,
  treeNode,
  onNodeUpdate,
  searchArea,
  onFocus,
  onBlur,
  'aria-controls': ariaControls,
  'aria-activedescendant': ariaActivedescendant,
}: ScopesTreeSearchProps) {
  const styles = useStyles2(getStyles);

  const [inputState, setInputState] = useState<{ value: string; dirty: boolean }>({
    value: treeNode.query,
    dirty: false,
  });

  useEffect(() => {
    if (!inputState.dirty && inputState.value !== treeNode.query) {
      setInputState({ value: treeNode.query, dirty: false });
    }
  }, [inputState, treeNode.query]);

  useDebounce(
    () => {
      if (inputState.dirty) {
        onNodeUpdate(treeNode.scopeNodeId, true, inputState.value);
      }
    },
    500,
    [inputState.dirty, inputState.value]
  );

  if (anyChildExpanded) {
    return null;
  }

  const searchLabel = t('scopes.tree.search', 'Search {{parentTitle}}', {
    parentTitle: searchArea,
  });

  return (
    <FilterInput
      placeholder={searchLabel}
      // Don't do autofocus for root node
      autoFocus={treeNode.scopeNodeId !== ''}
      role="combobox"
      aria-expanded={true}
      aria-autocomplete="list"
      aria-controls={ariaControls}
      aria-activedescendant={ariaActivedescendant}
      aria-label={searchLabel}
      value={inputState.value}
      className={styles.input}
      data-testid="scopes-tree-search"
      escapeRegex={false}
      onChange={(value) => {
        setInputState({ value, dirty: true });
      }}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    input: css({
      margin: theme.spacing(1, 0),
      minHeight: theme.spacing(4),
      height: theme.spacing(4),
      maxHeight: theme.spacing(4),
      width: `calc(100% - ${theme.spacing(0.5)})`,
    }),
  };
};
