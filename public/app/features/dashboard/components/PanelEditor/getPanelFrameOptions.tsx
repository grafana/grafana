import { DataLinksInlineEditor, Input, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import React, { useCallback, useMemo } from 'react';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';
import { OptionsPaneCategoryDescriptor, OptionsPaneItemDescriptor } from './OptionsPaneItems';
import { OptionPaneRenderProps } from './types';

export function getPanelFrameCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { panel, onPanelConfigChange } = props;

  const linkVariablesSuggestions = useMemo(() => getPanelLinksVariableSuggestions(), []);
  //const panelLinksCount = panel && panel.links ? panel.links.length : 0;

  const onRepeatRowSelectChange = useCallback((value: string | null) => onPanelConfigChange('repeat', value), [
    onPanelConfigChange,
  ]);

  return new OptionsPaneCategoryDescriptor({
    title: 'Panel frame',
    id: 'Panel frame',
  })
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Title',
        value: panel.title,
        render: function renderTitle() {
          return (
            <Input defaultValue={panel.title} onBlur={(e) => onPanelConfigChange('title', e.currentTarget.value)} />
          );
        },
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Description',
        description: panel.description,
        value: panel.description,
        render: function renderDescription() {
          return (
            <TextArea
              defaultValue={panel.description}
              onBlur={(e) => onPanelConfigChange('description', e.currentTarget.value)}
            />
          );
        },
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Transparent background',
        render: function renderTransparent() {
          return (
            <Switch
              value={panel.transparent}
              onChange={(e) => onPanelConfigChange('transparent', e.currentTarget.checked)}
            />
          );
        },
      })
    )
    .addCategory(
      new OptionsPaneCategoryDescriptor({
        title: 'Panel links',
        id: 'Panel links',
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: 'Panel links',
          render: function renderLinks() {
            return (
              <DataLinksInlineEditor
                links={panel.links}
                onChange={(links) => onPanelConfigChange('links', links)}
                suggestions={linkVariablesSuggestions}
                data={[]}
              />
            );
          },
        })
      )
    )
    .addCategory(
      new OptionsPaneCategoryDescriptor({
        title: 'Repeat options',
        id: 'Repeat options',
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: 'Repeat by variable',
          description:
            'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.',
          render: function renderRepeatOptions() {
            return <RepeatRowSelect repeat={panel.repeat} onChange={onRepeatRowSelectChange} />;
          },
        })
      )
    );
}
