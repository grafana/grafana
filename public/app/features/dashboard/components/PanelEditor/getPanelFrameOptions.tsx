import React from 'react';

import { DataLinksInlineEditor, Input, RadioButtonGroup, Select, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { AiGenerate } from './dashGPT/AiGenerate';
import { fetchData, regenerateResponseWithFeedback, SPECIAL_DONE_TOKEN } from './dashGPT/utils';
import { OptionPaneRenderProps } from './types';
import { getGeneratePayloadForTitle } from './utils';

// TODO: Consider saving these to local storage on a panel by panel basis? May not be necessary for demo purposes
let llmReplyTitle = '';
let llmReplyDescription = '';

let generatingTitle = false;
let generatingDescription = false;

let enabled = false;

let titleHistory: string[] = [];
let descriptionHistory: string[] = [];

export function getPanelFrameCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { panel, onPanelConfigChange } = props;
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: 'Panel options',
    id: 'Panel options',
    isOpenDefault: true,
  });

  const setPanelTitle = (title: string) => {
    const input = document.getElementById('PanelFrameTitle') as HTMLInputElement;
    input.value = title;
    onPanelConfigChange('title', title);
  };

  const setPanelDescription = (description: string) => {
    const input = document.getElementById('description-text-area') as HTMLInputElement;
    input.value = description;
    onPanelConfigChange('description', description);
  };

  const setLlmReply = (reply: string, subject: string) => {
    if (reply.indexOf(SPECIAL_DONE_TOKEN) >= 0) {
      reply = reply.replace(SPECIAL_DONE_TOKEN, '');
      reply = reply.replace(/"/g, '');

      if (subject === 'title') {
        generatingTitle = false;
        setPanelTitle(reply);
        if (titleHistory.indexOf(reply) === -1 && reply !== '') {
          titleHistory.push(reply);
        }
      } else {
        generatingDescription = false;
        setPanelDescription(reply);
        if (descriptionHistory.indexOf(reply) === -1 && reply !== '') {
          descriptionHistory.push(reply);
        }
      }

      return;
    }

    reply = reply.replace(/"/g, '');

    if (subject === 'title') {
      generatingTitle = true;

      llmReplyTitle = reply;
      if (enabled && llmReplyTitle !== '') {
        setPanelTitle(llmReplyTitle);
      }
    } else {
      generatingDescription = true;

      llmReplyDescription = reply;
      if (enabled && llmReplyDescription !== '') {
        setPanelDescription(llmReplyDescription);
      }
    }
  };

  const llmGenerate = (subject: string) => {
    const payload = getGeneratePayloadForTitle(panel);

    fetchData(payload, subject, setLlmReply)
      .then((response) => {
        enabled = response.enabled;
      })
      .catch((e) => console.log('error', e.message));
  };

  const llmReGenerate = async (
    subject: string,
    originalResponse: string,
    feedback: string,
    historyItemIndex: number
  ): Promise<boolean> => {
    const payload = getGeneratePayloadForTitle(panel);

    let updatedResponse: string | { enabled: any } = await regenerateResponseWithFeedback(
      payload,
      subject,
      originalResponse,
      feedback
    );

    if (typeof updatedResponse === 'string') {
      updatedResponse = updatedResponse.replace(SPECIAL_DONE_TOKEN, '');
      updatedResponse = updatedResponse.replace(/"/g, '');

      if (subject === 'title') {
        titleHistory[historyItemIndex] = updatedResponse;
      } else {
        descriptionHistory[historyItemIndex] = updatedResponse;
      }
    }

    return true;
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
        addon: (
          <AiGenerate
            text={generatingTitle ? 'Generating title' : 'Generate title'}
            onClick={() => llmGenerate('title')}
            history={titleHistory}
            applySuggestion={(suggestion: string) => setPanelTitle(suggestion)}
            llmReGenerate={llmReGenerate}
            type="title"
          />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Description',
        value: panel.description,
        render: function renderDescription() {
          return (
            <TextArea
              style={{ height: '100px' }}
              id="description-text-area"
              defaultValue={panel.description}
              onBlur={(e) => onPanelConfigChange('description', e.currentTarget.value)}
            />
          );
        },
        addon: (
          <AiGenerate
            text={generatingDescription ? 'Generating description' : 'Generate description'}
            onClick={() => llmGenerate('description')}
            history={descriptionHistory}
            applySuggestion={(suggestion: string) => setPanelDescription(suggestion)}
            llmReGenerate={llmReGenerate}
            type="description"
          />
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
                  onChange={(value?: string | null) => {
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
