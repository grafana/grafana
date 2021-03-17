import { DataLinksInlineEditor, Input, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import React, { useCallback, useMemo } from 'react';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';
import { OptionPaneRenderProps, OptionsPaneGroup } from './types';

export function getPanelFrameOptions(props: OptionPaneRenderProps): OptionsPaneGroup {
  const { panel, onPanelConfigChange } = props;

  const linkVariablesSuggestions = useMemo(() => getPanelLinksVariableSuggestions(), []);
  const panelLinksCount = panel && panel.links ? panel.links.length : 0;

  const onRepeatRowSelectChange = useCallback((value: string | null) => onPanelConfigChange('repeat', value), [
    onPanelConfigChange,
  ]);

  const panelOptions: OptionsPaneGroup = {
    title: 'Panel frame',
    items: [
      {
        title: 'Title',
        value: panel.title,
        reactNode: (
          <Input defaultValue={panel.title} onBlur={(e) => onPanelConfigChange('title', e.currentTarget.value)} />
        ),
      },
      {
        title: 'Description',
        description: 'Panel description supports markdown and links.',
        value: panel.description,
        reactNode: (
          <TextArea
            defaultValue={panel.description}
            onBlur={(e) => onPanelConfigChange('description', e.currentTarget.value)}
          />
        ),
      },
      {
        title: 'Transparent background',
        reactNode: (
          <Switch
            value={panel.transparent}
            onChange={(e) => onPanelConfigChange('transparent', e.currentTarget.checked)}
          />
        ),
      },
    ],
    groups: [
      {
        title: 'Panel links',
        count: panelLinksCount,
        items: [
          {
            title: 'Links',
            reactNode: (
              <DataLinksInlineEditor
                links={panel.links}
                onChange={(links) => onPanelConfigChange('links', links)}
                suggestions={linkVariablesSuggestions}
                data={[]}
              />
            ),
          },
        ],
      },
      {
        title: 'Repeat options',
        items: [
          {
            title: 'Repeat by variable',
            description:
              'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.',
            reactNode: <RepeatRowSelect repeat={panel.repeat} onChange={onRepeatRowSelectChange} />,
          },
        ],
      },
    ],
  };

  return panelOptions;
}
