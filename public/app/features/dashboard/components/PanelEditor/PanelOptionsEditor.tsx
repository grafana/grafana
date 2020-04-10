import React, { useMemo } from 'react';
import { PanelOptionsEditorItem, PanelPlugin } from '@grafana/data';
import { set as lodashSet, get as lodashGet } from 'lodash';
import { Forms } from '@grafana/ui';
import groupBy from 'lodash/groupBy';
import { OptionsGroup } from './OptionsGroup';

interface PanelOptionsEditorProps<TOptions> {
  plugin: PanelPlugin;
  options: TOptions;
  onChange: (options: TOptions) => void;
}

export const PanelOptionsEditor: React.FC<PanelOptionsEditorProps<any>> = ({ plugin, options, onChange }) => {
  const optionEditors = useMemo<Record<string, PanelOptionsEditorItem[]>>(() => {
    return groupBy(plugin.optionEditors.list(), i => {
      return i.category ? i.category[0] : 'Display';
    });
  }, [plugin]);

  const onOptionChange = (key: string, value: any) => {
    const newOptions = lodashSet({ ...options }, key, value);
    onChange(newOptions);
  };

  return (
    <>
      {Object.keys(optionEditors).map((c, i) => {
        const optionsToShow = optionEditors[c]
          .map((e, j) => {
            if (e.showIf && !e.showIf(options)) {
              return null;
            }

            const label = (
              <Forms.Label description={e.description} category={e.category?.slice(1)}>
                {e.name}
              </Forms.Label>
            );
            return (
              <Forms.Field label={label} key={`${e.id}/${j}`}>
                <e.editor
                  value={lodashGet(options, e.path)}
                  onChange={value => onOptionChange(e.path, value)}
                  item={e}
                />
              </Forms.Field>
            );
          })
          .filter(e => e !== null);

        return optionsToShow.length > 0 ? (
          <OptionsGroup title={c} defaultToClosed key={`${c}/${i}`}>
            <div>{optionsToShow}</div>
          </OptionsGroup>
        ) : null;
      })}
    </>
  );
};
