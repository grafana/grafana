import React, { useEffect } from 'react';

import { llms } from '@grafana/experimental';
import { DataLinksInlineEditor, Input, RadioButtonGroup, Select, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { AiAssist } from './dashGPT/AiAssist';
import { OptionPaneRenderProps } from './types';
import { GeneratePayload, getGeneratePayload } from './utils';

let llmReplyTitle = '';
let llmReplyDescription = '';

let generatingTitle = false;
let generatingDescription = false;

let enabled = false;

export function getPanelFrameCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { panel, onPanelConfigChange } = props;
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: 'Panel options',
    id: 'Panel options',
    isOpenDefault: true,
  });

  const setLlmReply = (reply: string, subject: string) => {
    if (subject === 'title') {
      generatingTitle = reply !== llmReplyTitle;

      llmReplyTitle = reply.replace(/^"(.*)"$/, '$1');
      if (enabled && llmReplyTitle !== '') {
        onPanelConfigChange('title', llmReplyTitle);
      }
    } else {
      generatingDescription = reply !== llmReplyDescription;

      llmReplyDescription = reply.replace(/^"(.*)"$/, '$1');
      if (enabled && llmReplyDescription !== '') {
        onPanelConfigChange('description', llmReplyDescription);
      }
    }

    setTimeout(() => {
      generatingTitle = false;
      generatingDescription = false;
      onPanelConfigChange('title', llmReplyTitle);
    }, 1000);
  };

  const fetchData = async (payload: GeneratePayload, subject: string) => {
    // Check if the LLM plugin is enabled and configured.
    // If not, we won't be able to make requests, so return early.
    const enabled = await llms.openai.enabled();
    if (!enabled) {
      return { enabled };
    }

    const getContent = () => {
      if (subject === 'title') {
        return (
          'You are an expert in creating Grafana Panels.' +
          'Your goal is to write short, descriptive, and concise panel titles for a given panel described by a JSON object' +
          'The title should be shorter than 50 characters. '
        );
      }

      return (
        'You are an expert in creating Grafana Panels.' +
        'Your goal is to write short, descriptive, and concise panel descriptions for a given panel described by a JSON object.' +
        'The description should be shorter than 150 characters' +
        'Describe what this panel might be monitoring and why it is useful.'
      );
    };

    llms.openai
      .streamChatCompletions({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: getContent(),
          },
          {
            role: 'user',
            // content: 'HELLO!',
            content: JSON.stringify(payload),
          },
        ],
      })
      .pipe(
        // Accumulate the stream content into a stream of strings, where each
        // element contains the accumulated message so far.
        llms.openai.accumulateContent()
      )
      .subscribe((response) => setLlmReply(response, subject));

    return { enabled };
  };

  const llmGenerate = (subject: string) => {
    const payload = getGeneratePayload(panel);

    fetchData(payload, subject)
      .then((response) => {
        enabled = response.enabled;
      })
      .catch((e) => console.log('error', e.message));
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
          <AiAssist
            text={generatingTitle ? 'Generating title' : 'Generate title'}
            onClick={() => llmGenerate('title')}
          />
        ),
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
        addon: (
          <AiAssist
            text={generatingDescription ? 'Generating description' : 'Generate description'}
            onClick={() => llmGenerate('description')}
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
