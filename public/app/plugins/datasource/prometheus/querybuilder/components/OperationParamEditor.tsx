import { css } from '@emotion/css';
import { GrafanaTheme2, toOption } from '@grafana/data';
import { Button, Input, Select, useStyles2 } from '@grafana/ui';
import React from 'react';
import { PromVisualQueryOperation, PromVisualQueryOperationParamDef } from '../types';

export interface Props {
  value?: string | number;
  paramDef: PromVisualQueryOperationParamDef;
  index: number;
  operation: PromVisualQueryOperation;
}

export function OperationParamEditor(props: Props) {
  const { paramDef, index, operation } = props;
  const styles = useStyles2(getStyles);

  return (
    <>
      <div className={styles.param}>
        <div className={styles.name}>{paramDef.name}</div>
        <div className={styles.value}>{renderParamInput(props)}</div>
      </div>
      {paramDef.restParam && index === operation.params.length - 1 && (
        <div className={styles.param}>
          <div className={styles.name}></div>
          <div className={styles.value}>
            <Button size="sm" icon="plus" variant="secondary" />
          </div>
        </div>
      )}
    </>
  );
}

function renderParamInput({ paramDef, value }: Props) {
  const { options } = paramDef;

  if (options && options?.length > 0) {
    const selectOptions = paramDef.options!.map((option) => ({
      label: option as string,
      value: option as string,
    }));

    return <Select value={toOption(value as string)} options={selectOptions} onChange={() => {}} />;
  }

  return <Input value={value ?? ''} onChange={() => {}} />;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    param: css({
      display: 'table-row',
    }),
    name: css({
      display: 'table-cell',
      padding: theme.spacing(0, 1, 0, 0),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    value: css({
      display: 'table-cell',
      paddingBottom: theme.spacing(0.5),
    }),
  };
};
