import React, { FC, useCallback, useMemo } from 'react';
import { DashboardModel, PanelModel } from '../../state';
import { PanelData, PanelPlugin } from '@grafana/data';
import { Counter, DataLinksInlineEditor, Field, Input, RadioButtonGroup, Select, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from '../../../panel/panellinks/link_srv';
import { AngularPanelOptions } from './AngularPanelOptions';
import { OptionsPaneCategory } from './OptionsPaneCategory';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';
import config from 'app/core/config';
import { LibraryPanelInformation } from 'app/features/library-panels/components/LibraryPanelInfo/LibraryPanelInfo';
import { isLibraryPanel } from '../../state/PanelModel';

interface Props {
  panel: PanelModel;
  plugin: PanelPlugin;
  data?: PanelData;
  dashboard: DashboardModel;
  onPanelConfigChange: (configKey: string, value: any) => void;
  onPanelOptionsChanged: (options: any) => void;
}

export const PanelOptionsTab: FC<Props> = ({
  panel,
  plugin,
  data,
  dashboard,
  onPanelConfigChange,
  onPanelOptionsChanged,
}) => {
  //const makeDummyEdit = useCallback(() => onPanelConfigChange('isEditing', true), []);
  const linkVariablesSuggestions = useMemo(() => getPanelLinksVariableSuggestions(), []);
  const onRepeatRowSelectChange = useCallback((value: string | null) => onPanelConfigChange('repeat', value), [
    onPanelConfigChange,
  ]);
  const elements: JSX.Element[] = [];
  const panelLinksCount = panel && panel.links ? panel.links.length : 0;

  const directionOptions = [
    { label: 'Horizontal', value: 'h' },
    { label: 'Vertical', value: 'v' },
  ];

  const maxPerRowOptions = [2, 3, 4, 6, 8, 12].map((value) => ({ label: value.toString(), value }));

  if (config.featureToggles.panelLibrary && isLibraryPanel(panel)) {
    elements.push(
      <LibraryPanelInformation
        panel={panel}
        formatDate={(dateString, format) => dashboard.formatDate(dateString, format)}
        key="Library Panel Information"
      />
    );
  }

  // First common panel settings Title, description
  elements.push(
    <OptionsPaneCategory title="Settings" id="Panel settings" key="Panel settings">
      <Field label="Panel title">
        <Input defaultValue={panel.title} onBlur={(e) => onPanelConfigChange('title', e.currentTarget.value)} />
      </Field>
      <Field label="Description" description="Panel description supports markdown and links.">
        <TextArea
          defaultValue={panel.description}
          onBlur={(e) => onPanelConfigChange('description', e.currentTarget.value)}
        />
      </Field>
      <Field label="Transparent" description="Display panel without a background.">
        <Switch
          value={panel.transparent}
          onChange={(e) => onPanelConfigChange('transparent', e.currentTarget.checked)}
        />
      </Field>
    </OptionsPaneCategory>
  );

  // Old legacy react editor
  if (plugin.editor && panel && !plugin.optionEditors) {
    elements.push(
      <OptionsPaneCategory title="Options" id="legacy react editor" key="legacy react editor">
        <plugin.editor data={data} options={panel.getOptions()} onOptionsChange={onPanelOptionsChanged} />
      </OptionsPaneCategory>
    );
  }

  if (plugin.angularPanelCtrl) {
    elements.push(
      <AngularPanelOptions panel={panel} dashboard={dashboard} plugin={plugin} key="angular panel options" />
    );
  }

  elements.push(
    <OptionsPaneCategory
      renderTitle={(isExpanded) => (
        <>Links {!isExpanded && panelLinksCount > 0 && <Counter value={panelLinksCount} />}</>
      )}
      id="panel links"
      key="panel links"
      defaultToClosed
    >
      <DataLinksInlineEditor
        links={panel.links}
        onChange={(links) => onPanelConfigChange('links', links)}
        suggestions={linkVariablesSuggestions}
        data={[]}
      />
    </OptionsPaneCategory>
  );

  elements.push(
    <OptionsPaneCategory title="Repeat options" id="panel repeats" key="panel repeats" defaultToClosed>
      <Field
        label="Repeat by variable"
        description="Repeat this panel for each value in the selected variable.
          This is not visible while in edit mode. You need to go back to dashboard and then update the variable or
          reload the dashboard."
      >
        <RepeatRowSelect repeat={panel.repeat} onChange={onRepeatRowSelectChange} />
      </Field>
      {panel.repeat && (
        <Field label="Repeat direction">
          <RadioButtonGroup
            options={directionOptions}
            value={panel.repeatDirection || 'h'}
            onChange={(value) => onPanelConfigChange('repeatDirection', value)}
          />
        </Field>
      )}

      {panel.repeat && panel.repeatDirection === 'h' && (
        <Field label="Max per row">
          <Select
            options={maxPerRowOptions}
            value={panel.maxPerRow}
            onChange={(value) => onPanelConfigChange('maxPerRow', value.value)}
          />
        </Field>
      )}
    </OptionsPaneCategory>
  );

  // if (config.featureToggles.panelLibrary) {
  //   elements.push(
  //     <PanelLibraryOptionsGroup panel={panel} dashboard={dashboard} onChange={makeDummyEdit} key="Panel Library" />
  //   );
  // }

  return <>{elements}</>;
};
