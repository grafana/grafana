import { css } from '@emotion/css';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { VariablePickerProps } from '../pickers/types';
import { KeyValueVariableModel } from '../types';
import { toKeyedVariableIdentifier } from '../utils';

import { removeKeyValueVariable } from './actions';

type Props = VariablePickerProps<KeyValueVariableModel> & ConnectedProps<typeof connector>;

const UnconnectedKeyValueVariablePicker: React.ComponentType<Props> = ({ variable, onRemoveVariable }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <div className={styles.value}>{variable.current.value}</div>{' '}
      <IconButton
        name="times"
        size="xs"
        type="button"
        onClick={(e) => {
          //   e.preventDefault();
          onRemoveVariable(toKeyedVariableIdentifier(variable));
        }}
      />
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css`
      align-items: center;
      border: 1px solid ${theme.colors.border.medium};
      height: 32px;
      display: flex;
      flex-direction: row;
      padding: ${theme.spacing(1, 0.5, 1, 1)};
      border-radius: ${theme.shape.borderRadius(1)};
    `,
    value: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.bodySmall.fontWeight};
      margin-right: ${theme.spacing(1)};
    `,
  };
}

const mapStateToProps = () => ({});
const mapDispatchToProps = {
  onRemoveVariable: removeKeyValueVariable,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export const KeyValueVariablePicker = connector(UnconnectedKeyValueVariablePicker);
