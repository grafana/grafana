import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Icon, Select, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { VisualQueryModeller, QueryBuilderOperation, QueryBuilderOperationDef } from './types';

export interface Props {
  operation: QueryBuilderOperation;
  def: QueryBuilderOperationDef;
  index: number;
  queryModeller: VisualQueryModeller;
  onChange: (index: number, update: QueryBuilderOperation) => void;
}

interface State {
  isOpen?: boolean;
  alternatives?: Array<SelectableValue<QueryBuilderOperationDef>>;
}

export const OperationName = React.memo<Props>(({ operation, def, index, onChange, queryModeller }) => {
  const styles = useStyles2(getStyles);
  const [state, setState] = useState<State>({});

  const onToggleSwitcher = () => {
    if (state.isOpen) {
      setState({ ...state, isOpen: false });
    } else {
      const alternatives = queryModeller
        .getAlternativeOperations(def.alternativesKey!)
        .map((alt) => ({ label: alt.name, value: alt }));
      setState({ isOpen: true, alternatives });
    }
  };

  const nameElement = <span>{def.name ?? def.id}</span>;

  if (!def.alternativesKey) {
    return nameElement;
  }

  return (
    <>
      {!state.isOpen && (
        <button
          className={styles.wrapper}
          onClick={onToggleSwitcher}
          title={'Click to replace with alternative function'}
        >
          {nameElement}
          <Icon className={`${styles.dropdown} operation-header-show-on-hover`} name="arrow-down" size="sm" />
        </button>
      )}
      {state.isOpen && (
        <Select
          autoFocus
          openMenuOnFocus
          placeholder="Replace with"
          options={state.alternatives}
          isOpen={true}
          onCloseMenu={onToggleSwitcher}
          onChange={(value) => {
            if (value.value) {
              const newDef = queryModeller.getOperationDef(value.value.id);
              let changedOp = { ...operation, id: value.value.id };
              onChange(index, def.changeTypeHandler ? def.changeTypeHandler(changedOp, newDef) : changedOp);
            }
          }}
        />
      )}
    </>
  );
});

OperationName.displayName = 'OperationName';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'inline-block',
      background: 'transparent',
      padding: 0,
      border: 'none',
      boxShadow: 'none',
      cursor: 'pointer',
    }),
    dropdown: css({
      opacity: 0,
      color: theme.colors.text.secondary,
    }),
  };
};
