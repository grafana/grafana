import { DataLinksInlineEditor, Input, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import React, { useCallback, useMemo, ReactElement } from 'react';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';
import { OptionsPaneCategory, OptionsPaneCategoryProps } from './OptionsPaneCategory';
import { OptionsPaneItem } from './OptionsPaneItem';
import { OptionPaneRenderProps } from './types';

export function getPanelFrameOptions(props: OptionPaneRenderProps): ReactElement<OptionsPaneCategoryProps> {
  const { panel, onPanelConfigChange } = props;

  const linkVariablesSuggestions = useMemo(() => getPanelLinksVariableSuggestions(), []);
  //const panelLinksCount = panel && panel.links ? panel.links.length : 0;

  const onRepeatRowSelectChange = useCallback((value: string | null) => onPanelConfigChange('repeat', value), [
    onPanelConfigChange,
  ]);

  return (
    <OptionsPaneCategory title="Panel frame" key="Panel frame" id="Panel frame">
      <OptionsPaneItem title="Title" value={panel.title}>
        <Input defaultValue={panel.title} onBlur={(e) => onPanelConfigChange('title', e.currentTarget.value)} />
      </OptionsPaneItem>
      <OptionsPaneItem
        title="Description"
        description="Panel description supports markdown and links"
        value={panel.description}
      >
        <TextArea
          defaultValue={panel.description}
          onBlur={(e) => onPanelConfigChange('description', e.currentTarget.value)}
        />
      </OptionsPaneItem>
      <OptionsPaneItem title="Transparent background">
        <Switch
          value={panel.transparent}
          onChange={(e) => onPanelConfigChange('transparent', e.currentTarget.checked)}
        />
      </OptionsPaneItem>
      <OptionsPaneCategory title="Panel links" id="Panel links" defaultToClosed nested>
        <OptionsPaneItem title="Links">
          <DataLinksInlineEditor
            links={panel.links}
            onChange={(links) => onPanelConfigChange('links', links)}
            suggestions={linkVariablesSuggestions}
            data={[]}
          />
        </OptionsPaneItem>
      </OptionsPaneCategory>
      <OptionsPaneCategory title="Repeat options" id="Repeat options" defaultToClosed nested>
        <OptionsPaneItem
          title="Repeat by variable"
          description="Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard."
        >
          <RepeatRowSelect repeat={panel.repeat} onChange={onRepeatRowSelectChange} />
        </OptionsPaneItem>
      </OptionsPaneCategory>
    </OptionsPaneCategory>
  );
}
