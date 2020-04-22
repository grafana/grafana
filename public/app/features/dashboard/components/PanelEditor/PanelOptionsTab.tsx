import React, { FC, useMemo, useRef } from 'react';
import { DashboardModel, PanelModel } from '../../state';
import { FieldConfigSource, PanelData, PanelPlugin, SelectableValue } from '@grafana/data';
import { Counter, DataLinksInlineEditor, Field, Input, RadioButtonGroup, Select, Switch, TextArea } from '@grafana/ui';
import { OptionsGroup } from './OptionsGroup';
import { getPanelLinksVariableSuggestions } from '../../../panel/panellinks/link_srv';
import { getVariables } from '../../../variables/state/selectors';
import { PanelOptionsEditor } from './PanelOptionsEditor';
import { AngularPanelOptions } from './AngularPanelOptions';
import { VisualizationTab } from './VisualizationTab';
import { LocalStorageValueProvider } from '../../../../core/components/LocalStorageValueProvider';
import { getOptionGroupStorageKey, onOptionGroupToggle, storeOptionGroupExpanded } from './utils';
import { defaultStorageItem, OptionGroupStorageItem, StoreOptionGroupCallback } from './types';

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
  const visTabInputRef = useRef<HTMLInputElement>();
  const linkVariablesSuggestions = useMemo(() => getPanelLinksVariableSuggestions(), []);
  const elements: JSX.Element[] = [];
  const panelLinksCount = panel && panel.links ? panel.links.length : 0;

  const variableOptions = getVariableOptions();
  const directionOptions = [
    { label: 'Horizontal', value: 'h' },
    { label: 'Vertical', value: 'v' },
  ];

  const maxPerRowOptions = [2, 3, 4, 6, 8, 12].map(value => ({ label: value.toString(), value }));

  const focusVisPickerInput = (onSaveToStore: StoreOptionGroupCallback) => (isExpanded: boolean) => {
    if (isExpanded && visTabInputRef.current) {
      visTabInputRef.current.focus();
    }
    storeOptionGroupExpanded(isExpanded, onSaveToStore);
  };
  // Fist common panel settings Title, description
  elements.push(
    <LocalStorageValueProvider<OptionGroupStorageItem>
      storageKey={getOptionGroupStorageKey('Panel settings')}
      defaultValue={defaultStorageItem}
      key="Panel settings"
    >
      {(values, onSaveToStore) => (
        <OptionsGroup
          title="Panel settings"
          defaultToClosed={values.defaultToClosed}
          onToggle={onOptionGroupToggle(onSaveToStore)}
        >
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
            <Switch
              value={panel.transparent}
              onChange={e => onPanelConfigChange('transparent', e.currentTarget.checked)}
            />
          </Field>
        </OptionsGroup>
      )}
    </LocalStorageValueProvider>
  );

  elements.push(
    <LocalStorageValueProvider<OptionGroupStorageItem>
      storageKey={getOptionGroupStorageKey('Panel type')}
      defaultValue={{ defaultToClosed: true }}
      key="Panel type"
    >
      {(values, onSaveToStore) => (
        <OptionsGroup
          title="Panel type"
          defaultToClosed={values.defaultToClosed}
          onToggle={focusVisPickerInput(onSaveToStore)}
        >
          <VisualizationTab panel={panel} ref={visTabInputRef} />
        </OptionsGroup>
      )}
    </LocalStorageValueProvider>
  );

  // Old legacy react editor
  if (plugin.editor && panel && !plugin.optionEditors) {
    elements.push(
      <LocalStorageValueProvider<OptionGroupStorageItem>
        storageKey={getOptionGroupStorageKey('legacy react editor')}
        defaultValue={{ defaultToClosed: true }}
        key="legacy react editor"
      >
        {(values, onSaveToStore) => (
          <OptionsGroup
            title="Display"
            defaultToClosed={values.defaultToClosed}
            onToggle={onOptionGroupToggle(onSaveToStore)}
          >
            <plugin.editor
              data={data}
              options={panel.getOptions()}
              onOptionsChange={onPanelOptionsChanged}
              fieldConfig={panel.getFieldConfig()}
              onFieldConfigChange={onFieldConfigsChange}
            />
          </OptionsGroup>
        )}
      </LocalStorageValueProvider>
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
    <LocalStorageValueProvider<OptionGroupStorageItem>
      storageKey={getOptionGroupStorageKey('panel links')}
      defaultValue={{ defaultToClosed: true }}
      key="panel links"
    >
      {(values, onSaveToStore) => (
        <OptionsGroup
          renderTitle={isExpanded => (
            <>Panel links {!isExpanded && panelLinksCount > 0 && <Counter value={panelLinksCount} />}</>
          )}
          defaultToClosed={values.defaultToClosed}
          onToggle={onOptionGroupToggle(onSaveToStore)}
        >
          <DataLinksInlineEditor
            links={panel.links}
            onChange={links => onPanelConfigChange('links', links)}
            suggestions={linkVariablesSuggestions}
            data={[]}
          />
        </OptionsGroup>
      )}
    </LocalStorageValueProvider>
  );

  elements.push(
    <LocalStorageValueProvider<OptionGroupStorageItem>
      storageKey={getOptionGroupStorageKey('panel repeats')}
      defaultValue={{ defaultToClosed: true }}
      key="panel repeats"
    >
      {(values, onSaveToStore) => (
        <OptionsGroup
          title="Panel repeats"
          defaultToClosed={values.defaultToClosed}
          onToggle={onOptionGroupToggle(onSaveToStore)}
        >
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
      )}
    </LocalStorageValueProvider>
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
