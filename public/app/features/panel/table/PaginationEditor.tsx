import * as React from 'react';

import type { StandardEditorProps } from '@grafana/data/field';
import { selectors } from '@grafana/e2e-selectors';
import { Switch } from '@grafana/ui';

export const PaginationEditor = ({ onChange, value, id }: StandardEditorProps<boolean>) => (
  <Switch
    id={id}
    label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Enable pagination`)}
    value={Boolean(value)}
    onChange={(event: React.FormEvent<HTMLInputElement> | undefined) => {
      onChange(event?.currentTarget.checked);
    }}
  />
);
