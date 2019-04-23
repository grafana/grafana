import React from 'react';
import { PanelOptionsGrid, PanelOptionsGroup } from '../../components/index';
import { OptionsUIModel, isOptionModel, isOptionsPanelModel, isSelectOption } from '../../types/panelOptions';

interface PanelOptionsBilderProps<TOptions> {
  uiModel: OptionsUIModel<TOptions>;
  options: TOptions;
  onOptionsChange: <K extends keyof TOptions>(key: K, value: TOptions[K]) => void;
}

export function PanelOptionsUIBuilder<TOptions extends { [key: string]: any }>(
  props: PanelOptionsBilderProps<TOptions>
) {
  const { uiModel, options } = props;
  return (
    <>
      {uiModel.rows.map(r => {
        return (
          <div>
            <PanelOptionsGrid cols={r.columns}>
              <>
                {r.content.map(c => {
                  if (isOptionModel(c)) {
                    if (!c.component) {
                      return null;
                    }
                    return React.createElement(c.component, {
                      value: options[c.path],
                      onChange: (value: any) => props.onOptionsChange(c.path, value),
                    });
                  } else {
                    if (isOptionsPanelModel(c)) {
                      return (
                        <PanelOptionsGroup title={c.groupOptions.title}>
                          {c.options.map(o => {
                            if (isSelectOption(o)) {
                              return React.createElement(o.component as any, {
                                value: options[o.path],
                                options: o.options,
                                onChange: (value: any) => props.onOptionsChange(o.path, value),
                                label: o.label,
                                placeholder: o.placeholder,
                              });
                            }
                            return React.createElement(o.component as any, {
                              value: options[o.path],
                              onChange: (value: any) => props.onOptionsChange(o.path, value),
                              label: o.label,
                              placeholder: o.placeholder,
                            });
                          })}
                        </PanelOptionsGroup>
                      );
                    } else {
                      return <h1>asd</h1>;
                    }
                  }
                })}
              </>
            </PanelOptionsGrid>
          </div>
        );
      })}
    </>
  );
}
