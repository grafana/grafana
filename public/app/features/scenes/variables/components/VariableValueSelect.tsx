import React from 'react';

import { InlineFormLabel } from '@grafana/ui';

import { SceneComponentProps } from '../../core/types';
import { SceneVariable } from '../types';

export function VariableValueSelect({ model }: SceneComponentProps<SceneVariable>) {
  const { name, value } = model.useState();

  return (
    <div className="submenu-item gf-form-inline">
      <InlineFormLabel>{name}</InlineFormLabel>
      <div>{value}</div>
    </div>
  );
}
