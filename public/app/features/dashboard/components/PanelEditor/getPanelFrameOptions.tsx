import { DataLinksInlineEditor, Input, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import React from 'react';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';
import { OptionsPaneCategoryDescriptor, OptionsPaneItemDescriptor } from './OptionsPaneItems';
import { OptionPaneRenderProps } from './types';

export function getPanelFrameCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { panel, onPanelConfigChange } = props;

  return new OptionsPaneCategoryDescriptor({
    title: 'Panel frame',
    id: 'Panel frame',
  })
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Title',
        value: panel.title,
        Component: function renderTitle() {
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
        Component: function renderDescription() {
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
        Component: function renderTransparent() {
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
          Component: function renderLinks() {
            return (
              <DataLinksInlineEditor
                links={panel.links}
                onChange={(links) => onPanelConfigChange('links', links)}
                getSuggestions={getPanelLinksVariableSuggestions}
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
          Component: function renderRepeatOptions() {
            return (
              <RepeatRowSelect
                repeat={panel.repeat}
                onChange={(value: string | null) => onPanelConfigChange('repeat', value)}
              />
            );
          },
        })
      )
    );
}
