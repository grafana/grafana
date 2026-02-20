import { useState } from 'react';

import { AITextArea, AITextInput } from '@grafana/assistant';
import { PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Dashboard, Panel } from '@grafana/schema';
import { DataLinksInlineEditor, Input, RadioButtonGroup, Select, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { NEW_PANEL_TITLE } from '../../utils/dashboard';
import { GenAIPanelDescriptionButton } from '../GenAI/GenAIPanelDescriptionButton';
import { GenAIPanelTitleButton } from '../GenAI/GenAIPanelTitleButton';
import { buildDescriptionInputSystemPrompt, buildTitleInputSystemPrompt } from '../GenAI/assistantContext';
import { useIsAssistantAvailable } from '../GenAI/hooks';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionPaneRenderProps } from './types';

export function getPanelFrameCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { dashboard, panel, onPanelConfigChange } = props;
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: t('dashboard.get-panel-frame-category.descriptor.title.panel-options', 'Panel options'),
    id: 'Panel options',
    isOpenDefault: true,
  });

  const panelFrameTitleId = 'panel-frame-title';
  const descriptionId = 'panel-frame-description';

  const setPanelTitle = (title: string) => {
    const input = document.getElementById(panelFrameTitleId);
    if (input instanceof HTMLInputElement) {
      input.value = title;
      onPanelConfigChange('title', title);
    }
  };

  const setPanelDescription = (description: string) => {
    const input = document.getElementById(descriptionId);
    if (input instanceof HTMLTextAreaElement) {
      input.value = description;
      onPanelConfigChange('description', description);
    }
  };

  const saveModel = panel.getSaveModel();
  const dashboardModel = dashboard.getSaveModelClone();

  return descriptor
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.get-panel-frame-category.title.title', 'Title'),
        id: panelFrameTitleId,
        value: panel.title,
        popularRank: 1,
        render: function renderTitle(descriptor) {
          return (
            <LegacyPanelTitleInput
              id={descriptor.props.id}
              panel={saveModel}
              dashboard={dashboardModel}
              data={props.data}
              defaultValue={panel.title}
              onCommit={(title) => onPanelConfigChange('title', title)}
            />
          );
        },
        addon: config.featureToggles.dashgpt && (
          <GenAIPanelTitleButton
            onGenerate={setPanelTitle}
            panel={saveModel}
            dashboard={dashboardModel}
            data={props.data}
          />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.get-panel-frame-category.title.description', 'Description'),
        id: descriptionId,
        description: panel.description,
        value: panel.description,
        render: function renderDescription(descriptor) {
          return (
            <LegacyPanelDescriptionInput
              id={descriptor.props.id}
              panel={saveModel}
              dashboard={dashboardModel}
              data={props.data}
              defaultValue={panel.description ?? ''}
              onCommit={(desc) => onPanelConfigChange('description', desc)}
            />
          );
        },
        addon: config.featureToggles.dashgpt && (
          <GenAIPanelDescriptionButton
            onGenerate={setPanelDescription}
            panel={saveModel}
            dashboard={dashboardModel}
            data={props.data}
          />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.get-panel-frame-category.title.transparent-background', 'Transparent background'),
        id: 'panel-frame-transparent-bg',
        render: function renderTransparent(descriptor) {
          return (
            <Switch
              data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Transparent background')}
              value={panel.transparent}
              id={descriptor.props.id}
              onChange={(e) => onPanelConfigChange('transparent', e.currentTarget.checked)}
            />
          );
        },
      })
    )
    .addCategory(
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard.get-panel-frame-category.title.panel-links', 'Panel links'),
        id: 'panel-frame-links-category',
        isOpenDefault: false,
        itemsCount: panel.links?.length,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.get-panel-frame-category.title.panel-links', 'Panel links'),
          id: 'panel-frame-links-category',
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
        title: t('dashboard.get-panel-frame-category.title.repeat-options', 'Repeat options'),
        id: 'panel-frame-repeat',
        isOpenDefault: false,
      })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.get-panel-frame-category.title.repeat-by-variable', 'Repeat by variable'),
            id: 'panel-frame-repeat-by-variable',
            description:
              'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.',
            render: function renderRepeatOptions(descriptor) {
              return (
                <RepeatRowSelect
                  id={descriptor.props.id}
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
            title: t('dashboard.get-panel-frame-category.title.repeat-direction', 'Repeat direction'),
            id: 'panel-frame-repeat-direction',
            showIf: () => !!panel.repeat,
            render: function renderRepeatOptions() {
              const directionOptions = [
                {
                  label: t('dashboard.get-panel-frame-category.direction-options.label.horizontal', 'Horizontal'),
                  value: 'h',
                },
                {
                  label: t('dashboard.get-panel-frame-category.direction-options.label.vertical', 'Vertical'),
                  value: 'v',
                },
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
            title: t('dashboard.get-panel-frame-category.title.max-per-row', 'Max per row'),
            id: 'panel-frame-repeat-max-per-row',
            showIf: () => Boolean(panel.repeat && panel.repeatDirection === 'h'),
            render: function renderOption(descriptor) {
              const maxPerRowOptions = [2, 3, 4, 6, 8, 12].map((value) => ({ label: value.toString(), value }));
              return (
                <Select
                  id={descriptor.props.id}
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

interface LegacyPanelInputProps {
  id: string;
  panel: Panel;
  dashboard: Dashboard;
  data?: PanelData;
  defaultValue: string;
  onCommit: (value: string) => void;
}

function LegacyPanelTitleInput({ id, panel, dashboard, data, defaultValue, onCommit }: LegacyPanelInputProps) {
  const isAssistant = useIsAssistantAvailable();
  const isDefault = !defaultValue || defaultValue === NEW_PANEL_TITLE;
  const [value, setValue] = useState(isAssistant && isDefault ? '' : defaultValue);
  const systemPrompt = isAssistant ? buildTitleInputSystemPrompt(panel, dashboard, data) : undefined;

  if (isAssistant) {
    return (
      <AITextInput
        data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Title')}
        value={value}
        onChange={(val) => {
          setValue(val);
          onCommit(val);
        }}
        systemPrompt={systemPrompt}
        origin="grafana/panel-metadata/title"
        placeholder={t('dashboard.panel-title-input.placeholder', 'Type a title or let AI generate one...')}
        autoGenerate={isDefault}
        streaming
      />
    );
  }

  return (
    <Input
      data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Title')}
      id={id}
      defaultValue={defaultValue}
      onBlur={(e) => onCommit(e.currentTarget.value)}
    />
  );
}

function LegacyPanelDescriptionInput({ id, panel, dashboard, data, defaultValue, onCommit }: LegacyPanelInputProps) {
  const isAssistant = useIsAssistantAvailable();
  const [value, setValue] = useState(defaultValue);
  const systemPrompt = isAssistant ? buildDescriptionInputSystemPrompt(panel, dashboard, data) : undefined;

  if (isAssistant) {
    return (
      <AITextArea
        data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Description')}
        value={value}
        onChange={(val) => {
          setValue(val);
          onCommit(val);
        }}
        systemPrompt={systemPrompt}
        origin="grafana/panel-metadata/description"
        placeholder={t('dashboard.panel-description-input.placeholder', 'Type a description or let AI generate one...')}
        autoGenerate={!defaultValue}
        streaming
      />
    );
  }

  return (
    <TextArea
      data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Description')}
      id={id}
      defaultValue={defaultValue}
      onBlur={(e) => onCommit(e.currentTarget.value)}
    />
  );
}
