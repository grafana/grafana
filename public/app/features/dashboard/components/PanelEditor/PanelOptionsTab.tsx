import React, { FC, useMemo } from 'react';
import { PanelModel, DashboardModel } from '../../state';
import { SelectableValue, PanelPlugin, FieldConfigSource, PanelData } from '@grafana/data';
import { Switch, Select, DataLinksInlineEditor, Input, TextArea, RadioButtonGroup, Field } from '@grafana/ui';
import { OptionsGroup } from './OptionsGroup';
import { getPanelLinksVariableSuggestions } from '../../../panel/panellinks/link_srv';
import { getVariables } from '../../../variables/state/selectors';
import { PanelOptionsEditor } from './PanelOptionsEditor';
import { AngularPanelOptions } from '../../panel_editor/AngularPanelOptions';

interface Props {
  panel: PanelModel;
  plugin: PanelPlugin;
  data: PanelData;
  dashboard: DashboardModel;
  onPanelConfigChange: (configKey: string, value: any) => void;
  onPanelOptionsChanged: (options: any) => void;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
}

export const PanelOptionsTab: FC<Props> = ({
  panel,
  plugin,
  data,
  dashboard,
  onPanelConfigChange,
  onPanelOptionsChanged,
  onFieldConfigsChange,
}) => {
  const elements: JSX.Element[] = [];
  const linkVariablesSuggestions = useMemo(() => getPanelLinksVariableSuggestions(), []);

  const variableOptions = getVariableOptions();
  const directionOptions = [
    { label: 'Horizontal', value: 'h' },
    { label: 'Vertical', value: 'v' },
  ];

  const maxPerRowOptions = [2, 3, 4, 6, 8, 12].map(value => ({ label: value.toString(), value }));

  // Fist common panel settings Title, description
  elements.push(
    <OptionsGroup title="Basic" key="basic settings">
      <Field label="Panel title">
        <Input defaultValue={panel.title} onBlur={e => onPanelConfigChange('title', e.currentTarget.value)} />
      </Field>
      <Field label="Description" description="Panel description supports markdown and links.">
        <TextArea
          defaultValue={panel.description}
          onBlur={e => onPanelConfigChange('description', e.currentTarget.value)}
        />
      </Field>
      <Field label="Transparent" description="Display panel without a background.">
        <Switch value={panel.transparent} onChange={e => onPanelConfigChange('transparent', e.currentTarget.checked)} />
      </Field>
    </OptionsGroup>
  );

  // Old legacy react editor
  if (plugin.editor && panel && !plugin.optionEditors) {
    elements.push(
      <OptionsGroup title="Display" key="legacy react editor">
        <plugin.editor
          data={data}
          options={panel.getOptions()}
          onOptionsChange={onPanelOptionsChanged}
          fieldConfig={panel.getFieldConfig()}
          onFieldConfigChange={onFieldConfigsChange}
        />
      </OptionsGroup>
    );
  }

  if (plugin.optionEditors && panel) {
    elements.push(
      <PanelOptionsEditor
        key="panel options"
        options={panel.getOptions()}
        onChange={onPanelOptionsChanged}
        plugin={plugin}
      />
    );
  }

  if (plugin.angularPanelCtrl) {
    elements.push(
      <AngularPanelOptions panel={panel} dashboard={dashboard} plugin={plugin} key="angular panel options" />
    );
  }

  elements.push(
    <OptionsGroup title="Panel links" key="panel links" defaultToClosed={true}>
      <DataLinksInlineEditor
        links={panel.links}
        onChange={links => onPanelConfigChange('links', links)}
        suggestions={linkVariablesSuggestions}
        data={[]}
      />
    </OptionsGroup>
  );

  elements.push(
    <OptionsGroup title="Panel repeats" key="panel repeats" defaultToClosed={true}>
      <Field
        label="Repeat by variable"
        description="Repeat this panel for each value in the selected variable.
          This is not visible while in edit mode. You need to go back to dashboard and then update the variable or
          reload the dashboard."
      >
        <Select
          value={panel.repeat}
          onChange={value => onPanelConfigChange('repeat', value.value)}
          options={variableOptions}
        />
      </Field>
      {panel.repeat && (
        <Field label="Repeat direction">
          <RadioButtonGroup
            options={directionOptions}
            value={panel.repeatDirection || 'h'}
            onChange={value => onPanelConfigChange('repeatDirection', value)}
          />
        </Field>
      )}

      {panel.repeat && panel.repeatDirection === 'h' && (
        <Field label="Max per row">
          <Select
            options={maxPerRowOptions}
            value={panel.maxPerRow}
            onChange={value => onPanelConfigChange('maxPerRow', value.value)}
          />
        </Field>
      )}
    </OptionsGroup>
  );

  return <>{elements}</>;
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
