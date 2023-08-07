import React from 'react';

import { llms } from '@grafana/experimental';
import { DataLinksInlineEditor, Input, RadioButtonGroup, Select, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { AiAssist } from './dashGPT/AiAssist';
import { OptionPaneRenderProps } from './types';
import { GeneratePayload, getGeneratePayload } from './utils';

export function getPanelFrameCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { panel, onPanelConfigChange } = props;
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: 'Panel options',
    id: 'Panel options',
    isOpenDefault: true,
  });

  let llmReply = '';

  const setLlmReply = (reply: string, subject: string) => {
    llmReply = reply.replace(/^"(.*)"$/, '$1');
    // @TODO move this to a better place
    if (subject === 'title') {
      onTitleChange(llmReply);
    } else {
      onDescriptionChange(llmReply);
    }
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
          'You are an expert in creating Grafana Panels. ' +
          'Generate one title for this panel with a maximum of 100 characters. ' +
          'Provide just the title text.' +
          'Look at user content "panelTitles"'
        );
      }

      return (
        'You are an expert in creating Grafana Panels. ' +
        'Generate one description for this panel with a minimum of 50 characters and a maximum of 150 characters. ' +
        'Describe what this panel might be monitoring and why it is useful. Provide just the description text.' +
        "Describe the panel's thresholds"
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

    fetchData(payload, subject).catch((e) => console.log('error', e.message));
  };

  // @TODO Refactor
  const onTitleChange = (value: string) => {
    const input = document.getElementById('PanelFrameTitle') as HTMLInputElement;
    input.value = value;

    onPanelConfigChange('title', value);
  };

  const onDescriptionChange = (value: string) => {
    const input = document.getElementById('description-text-area') as HTMLTextAreaElement;
    input.value = value;

    onPanelConfigChange('description', value);
  };

  const getText = () => {
    if (llmReply !== '') {
      return 'Regenerate';
    }

    return 'Generate';
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
              onBlur={(e) => onTitleChange(e.currentTarget.value)}
            />
          );
        },
        addon: <AiAssist text={`${getText()} title`} onClick={() => llmGenerate('title')} />,
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
              onBlur={(e) => onDescriptionChange(e.currentTarget.value)}
            />
          );
        },
        addon: <AiAssist text={`${getText()} description`} onClick={() => llmGenerate('description')} />,
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
