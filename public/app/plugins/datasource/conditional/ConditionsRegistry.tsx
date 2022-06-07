import React from 'react';

import { PanelData, Registry, RegistryItemWithOptions } from '@grafana/data';
import { Input } from '@grafana/ui';

export interface CondtionInfo<TOptions = any> extends RegistryItemWithOptions {
  evaluate: (options: TOptions) => (panelData: PanelData) => boolean;
  editor: React.ComponentType<ConditionUIProps<TOptions>>;
}

interface FieldClickConditionOptions {
  pattern: string;
}

interface ConditionUIProps<TOptions = any> {
  options: TOptions;
  onChange: (options: TOptions) => void;
}

export enum ConditionID {
  FieldClick = 'field-click',
}

export const fieldClickCondition: CondtionInfo<FieldClickConditionOptions> = {
  id: ConditionID.FieldClick,
  name: 'field click',
  description: 'When a field is clicked',
  defaultOptions: {},
  evaluate: (options: FieldClickConditionOptions) => (panelData: PanelData) => {
    return true;
  },
  editor: ({ onChange, options }) => {
    return (
      <div>
        When field matching pattern is clicked:{' '}
        <Input
          onBlur={(e) => {
            onChange({ ...options, pattern: e.target.value });
          }}
          defaultValue={options.pattern}
        />
      </div>
    );
  },
};

export const conditionsRegistry = new Registry<CondtionInfo>();

export const getConditionItems = () => [fieldClickCondition];
