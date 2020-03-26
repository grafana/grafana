import React, { useMemo } from 'react';
import { PanelPlugin } from '@grafana/data';
import { Forms } from '@grafana/ui';

interface PanelOptionsEditorProps<TOptions> {
  plugin: PanelPlugin;
  options: TOptions;
  onChange: (options: TOptions) => void;
}

export const PanelOptionsEditor: React.FC<PanelOptionsEditorProps<any>> = ({ plugin, options, onChange }) => {
  const optionEditors = useMemo(() => plugin.optionEditors, [plugin]);

  const onOptionChange = (key: string, value: any) => {
    onChange({
      ...options,
      [key]: value,
    });
  };

  return (
    <>
      {optionEditors.list().map(e => {
        return (
          <Forms.Field label={e.name} description={e.description}>
            <e.editor value={options[e.id]} onChange={value => onOptionChange(e.id, value)} item={e} />
          </Forms.Field>
        );
      })}
    </>
  );
};
