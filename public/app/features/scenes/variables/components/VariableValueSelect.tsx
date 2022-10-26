import React from 'react';

import { LoadingState } from '@grafana/data';
import { Icon, InlineFormLabel } from '@grafana/ui';

import { SceneComponentProps } from '../../core/types';
import { SceneVariable } from '../types';

export function VariableValueSelect({ model }: SceneComponentProps<SceneVariable>) {
  const { name, value, state } = model.useState();

  return (
    <div className="submenu-item gf-form-inline">
      <InlineFormLabel width="auto">{name}</InlineFormLabel>
      <InlineFormLabel width="auto">
        {value}
        {state === LoadingState.Loading && <Icon name="fa fa-spinner" />}
      </InlineFormLabel>
    </div>
  );
}
