import React, { useMemo, FC } from 'react';
import { PanelModel } from '../../state';
import { SelectableValue } from '@grafana/data';
import { Forms, DataLinksInlineEditor } from '@grafana/ui';
import { OptionsGroup } from './OptionsGroup';
import { getPanelLinksVariableSuggestions } from '../../../panel/panellinks/link_srv';
import { getVariables } from '../../../variables/state/selectors';

export const GeneralPanelOptions: FC<{
  panel: PanelModel;
  onPanelConfigChange: (configKey: string, value: any) => void;
}> = ({ panel, onPanelConfigChange }) => {
  const linkVariablesSuggestions = useMemo(() => getPanelLinksVariableSuggestions(), []);

  const variableOptions = getVariableOptions();
  const directionOptions = [
    { label: 'Horizontal', value: 'h' },
    { label: 'Vertical', value: 'v' },
  ];

  const maxPerRowOptions = [2, 3, 4, 6, 8, 12].map(value => ({ label: value.toString(), value }));

  return (
    <div>
      <OptionsGroup title="Panel settings">
        <Forms.Field label="Panel title">
          <Forms.Input defaultValue={panel.title} onBlur={e => onPanelConfigChange('title', e.currentTarget.value)} />
        </Forms.Field>
        <Forms.Field label="Description" description="Panel description supports markdown and links.">
          <Forms.TextArea
            defaultValue={panel.description}
            onBlur={e => onPanelConfigChange('description', e.currentTarget.value)}
          />
        </Forms.Field>
        <Forms.Field label="Transparent" description="Display panel without background.">
          <Forms.Switch
            value={panel.transparent}
            onChange={e => onPanelConfigChange('transparent', e.currentTarget.checked)}
          />
        </Forms.Field>
      </OptionsGroup>
      <OptionsGroup title="Panel links">
        <DataLinksInlineEditor
          links={panel.links}
          onChange={links => onPanelConfigChange('links', links)}
          suggestions={linkVariablesSuggestions}
          data={[]}
        />
      </OptionsGroup>
      <OptionsGroup title="Panel repeats">
        <Forms.Field
          label="Repeat by variable"
          description="Repeat this panel for each value in the selected variable.
          This is not visible while in edit mode. You need to go back to dashboard and then update the variable or
          reload the dashboard."
        >
          <Forms.Select
            value={panel.repeat}
            onChange={value => onPanelConfigChange('repeat', value.value)}
            options={variableOptions}
          />
        </Forms.Field>
        {panel.repeat && (
          <Forms.Field label="Repeat direction">
            <Forms.RadioButtonGroup
              options={directionOptions}
              value={panel.repeatDirection || 'h'}
              onChange={value => onPanelConfigChange('repeatDirection', value)}
            />
          </Forms.Field>
        )}

        {panel.repeat && panel.repeatDirection === 'h' && (
          <Forms.Field label="Max per row">
            <Forms.Select
              options={maxPerRowOptions}
              value={panel.maxPerRow}
              onChange={value => onPanelConfigChange('maxPerRow', value.value)}
            />
          </Forms.Field>
        )}
      </OptionsGroup>
    </div>
  );
};

function getVariableOptions(): Array<SelectableValue<string>> {
  const options = getVariables().map((item: any) => {
    return { label: item.name, value: item.name };
  });

  if (options.length === 0) {
    options.unshift({
      label: 'No template variables found',
      value: null,
    });
  }

  options.unshift({
    label: 'Disable repeating',
    value: null,
  });

  return options;
}
