import React from 'react';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { DataLinksInlineEditor, Input, RadioButtonGroup, Select, Switch, TextArea } from '@grafana/ui';
import { VizPanelManager, VizPanelManagerState } from 'app/features/dashboard-scene/panel-edit/VizPanelManager';
import { VizPanelLinks } from 'app/features/dashboard-scene/scene/PanelLinks';
import { dashboardSceneGraph } from 'app/features/dashboard-scene/utils/dashboardSceneGraph';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { GenAIPanelDescriptionButton } from '../GenAI/GenAIPanelDescriptionButton';
import { GenAIPanelTitleButton } from '../GenAI/GenAIPanelTitleButton';
import { RepeatRowSelect, RepeatRowSelect2 } from '../RepeatRowSelect/RepeatRowSelect';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionPaneRenderProps } from './types';

export function getPanelFrameCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { panel, onPanelConfigChange } = props;
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: 'Panel options',
    id: 'Panel options',
    isOpenDefault: true,
  });

  const setPanelTitle = (title: string) => {
    const input = document.getElementById('PanelFrameTitle');
    if (input instanceof HTMLInputElement) {
      input.value = title;
      onPanelConfigChange('title', title);
    }
  };

  const setPanelDescription = (description: string) => {
    const input = document.getElementById('description-text-area');
    if (input instanceof HTMLTextAreaElement) {
      input.value = description;
      onPanelConfigChange('description', description);
    }
  };

  return descriptor
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Title',
        value: panel.title,
        popularRank: 1,
        render: function renderTitle() {
          return (
            <Input
              id="PanelFrameTitle"
              defaultValue={panel.title}
              onBlur={(e) => onPanelConfigChange('title', e.currentTarget.value)}
            />
          );
        },
        addon: config.featureToggles.dashgpt && <GenAIPanelTitleButton onGenerate={setPanelTitle} panel={panel} />,
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
              id="description-text-area"
              defaultValue={panel.description}
              onBlur={(e) => onPanelConfigChange('description', e.currentTarget.value)}
            />
          );
        },
        addon: config.featureToggles.dashgpt && (
          <GenAIPanelDescriptionButton onGenerate={setPanelDescription} panel={panel} />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Transparent background',
        render: function renderTransparent() {
          return (
            <Switch
              value={panel.transparent}
              id="transparent-background"
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
        isOpenDefault: false,
        itemsCount: panel.links?.length,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: 'Panel links',
          render: function renderLinks() {
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
        isOpenDefault: false,
      })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Repeat by variable',
            description:
              'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.',
            render: function renderRepeatOptions() {
              return (
                <RepeatRowSelect
                  id="repeat-by-variable-select"
                  repeat={panel.repeat}
                  onChange={(value?: string) => {
                    onPanelConfigChange('repeat', value);
                  }}
                />
              );
            },
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Repeat direction',
            showIf: () => !!panel.repeat,
            render: function renderRepeatOptions() {
              const directionOptions = [
                { label: 'Horizontal', value: 'h' },
                { label: 'Vertical', value: 'v' },
              ];

              return (
                <RadioButtonGroup
                  options={directionOptions}
                  value={panel.repeatDirection || 'h'}
                  onChange={(value) => onPanelConfigChange('repeatDirection', value)}
                />
              );
            },
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Max per row',
            showIf: () => Boolean(panel.repeat && panel.repeatDirection === 'h'),
            render: function renderOption() {
              const maxPerRowOptions = [2, 3, 4, 6, 8, 12].map((value) => ({ label: value.toString(), value }));
              return (
                <Select
                  options={maxPerRowOptions}
                  value={panel.maxPerRow}
                  onChange={(value) => onPanelConfigChange('maxPerRow', value.value)}
                />
              );
            },
          })
        )
    );
}

export function getPanelFrameCategory2(
  panelManager: VizPanelManager,
  panel: VizPanel,
  repeat?: string
): OptionsPaneCategoryDescriptor {
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: 'Panel options',
    id: 'Panel options',
    isOpenDefault: true,
  });

  const panelLinksObject = dashboardSceneGraph.getPanelLinks(panel);
  const links = panelLinksObject?.state.rawLinks ?? [];

  return descriptor
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Title',
        value: panel.state.title,
        popularRank: 1,
        render: function renderTitle() {
          return (
            <Input
              id="PanelFrameTitle"
              defaultValue={panel.state.title}
              onBlur={(e) => panel.setState({ title: e.currentTarget.value })}
            />
          );
        },
        // addon: config.featureToggles.dashgpt && <GenAIPanelTitleButton onGenerate={setPanelTitle} panel={panel} />,
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Description',
        description: panel.state.description,
        value: panel.state.description,
        render: function renderDescription() {
          return (
            <TextArea
              id="description-text-area"
              defaultValue={panel.state.description}
              onBlur={(e) => panel.setState({ description: e.currentTarget.value })}
            />
          );
        },
        // addon: config.featureToggles.dashgpt && (
        //   <GenAIPanelDescriptionButton onGenerate={setPanelDescription} panel={panel} />
        // ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Transparent background',
        render: function renderTransparent() {
          return (
            <Switch
              value={panel.state.displayMode === 'transparent'}
              id="transparent-background"
              onChange={() => {
                panel.setState({
                  displayMode: panel.state.displayMode === 'transparent' ? 'default' : 'transparent',
                });
              }}
            />
          );
        },
      })
    )
    .addCategory(
      new OptionsPaneCategoryDescriptor({
        title: 'Panel links',
        id: 'Panel links',
        isOpenDefault: false,
        itemsCount: links?.length,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: 'Panel links',
          render: () => <ScenePanelLinksEditor panelLinks={panelLinksObject ?? undefined} />,
        })
      )
    )
    .addCategory(
      new OptionsPaneCategoryDescriptor({
        title: 'Repeat options',
        id: 'Repeat options',
        isOpenDefault: false,
      })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Repeat by variable',
            description:
              'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.',
            render: function renderRepeatOptions() {
              return (
                <RepeatRowSelect2
                  id="repeat-by-variable-select"
                  parent={panel}
                  repeat={repeat}
                  onChange={(value?: string) => {
                    const stateUpdate: Partial<VizPanelManagerState> = { repeat: value };
                    if (value && !panelManager.state.repeatDirection) {
                      stateUpdate.repeatDirection = 'h';
                    }
                    panelManager.setState(stateUpdate);
                  }}
                />
              );
            },
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Repeat direction',
            showIf: () => !!panelManager.state.repeat,
            render: function renderRepeatOptions() {
              const directionOptions: Array<SelectableValue<'h' | 'v'>> = [
                { label: 'Horizontal', value: 'h' },
                { label: 'Vertical', value: 'v' },
              ];

              return (
                <RadioButtonGroup
                  options={directionOptions}
                  value={panelManager.state.repeatDirection ?? 'h'}
                  onChange={(value) => panelManager.setState({ repeatDirection: value })}
                />
              );
            },
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Max per row',
            showIf: () => Boolean(panelManager.state.repeat && panelManager.state.repeatDirection === 'h'),
            render: function renderOption() {
              const maxPerRowOptions = [2, 3, 4, 6, 8, 12].map((value) => ({ label: value.toString(), value }));
              return (
                <Select
                  options={maxPerRowOptions}
                  value={panelManager.state.maxPerRow}
                  onChange={(value) => panelManager.setState({ maxPerRow: value.value })}
                />
              );
            },
          })
        )
    );
}

interface ScenePanelLinksEditorProps {
  panelLinks?: VizPanelLinks;
}

function ScenePanelLinksEditor({ panelLinks }: ScenePanelLinksEditorProps) {
  const { rawLinks: links } = panelLinks ? panelLinks.useState() : { rawLinks: [] };

  return (
    <DataLinksInlineEditor
      links={links}
      onChange={(links) => panelLinks?.setState({ rawLinks: links })}
      getSuggestions={getPanelLinksVariableSuggestions}
      data={[]}
    />
  );
}
