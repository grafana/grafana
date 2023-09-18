import React from 'react';

import { Diffs } from '../VersionHistory/utils';

import { GenAIButton } from './GenAIButton';
import { Message, Role } from './utils';

interface GenAIDashboardChangesButtonProps {
  onGenerate: (title: string, isDone: boolean) => void;
  diff: Diffs;
}

const CHANGES_GENERATION_STANDARD_PROMPT =
  'You are an expert in Grafana Dashboards.' +
  'Your goal is to write a description of the changes for a dashboard.' +
  'When refering to panel changes, use the panel title.' +
  'Group all the positioning changes together under the title "Panel position changes".' +
  'Group changes when all panels are affected.' +
  'Do not mention line number.' +
  'Refer to templating element as variables.' +
  'Try to make it as short as possible.' +
  'Ignore the changes related to plugin version and schema version.';

export const GenAIDashboardChangesButton = ({ onGenerate, diff }: GenAIDashboardChangesButtonProps) => {
  function getMessages(): Message[] {
    return [
      {
        content: CHANGES_GENERATION_STANDARD_PROMPT,
        role: Role.system,
      },
      {
        content: 'The following messages repfresents is the list of the changes:',
        role: Role.system,
      },
      ...getDiffMessages(diff),
    ];
  }

  return <GenAIButton messages={getMessages()} onReply={onGenerate} loadingText={'Generating title'} />;
};

function getDiffMessages(diff: Diffs): Message[] {
  return Object.entries(diff)
    .map(([key, value]) => value)
    .map((diff) => {
      let content;
      try {
        content = JSON.stringify(diff, null, 2);
      } catch (e) {
        content = '';
      }
      return { content, role: Role.system };
    })
    .filter((message) => !!message.content);
}
