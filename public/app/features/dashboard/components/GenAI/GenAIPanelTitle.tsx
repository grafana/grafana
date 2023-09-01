import React, { useState } from 'react';

import { PanelModel } from '@grafana/data';

import { GenAIButton } from './GenAIButton';
import {
  getGeneratePayloadForPanelTitleAndDescription,
  onGenerateTextWithAI,
  SPECIAL_DONE_TOKEN,
} from './GenAIService';

interface GenAIPanelTitleProps {
  setPanelTitle: (title: string) => void;
  panel: PanelModel;
}

export const GenAIPanelTitle = ({ setPanelTitle, panel }: GenAIPanelTitleProps) => {
  const [isTitleGenerating, setIsTitleGenerating] = useState(false);

  // TODO: Figure out better state management for this possibly (useState results in stale value on first run)
  let isGenAIEnabled = false;

  const onGenAIButtonClick = () => {
    // TODO: Improve this to be enum or some other way of handling
    generateAITitleResult('title');
  };

  const generateAITitleResult = (subject: string) => {
    const payload = getGeneratePayloadForPanelTitleAndDescription(panel);

    onGenerateTextWithAI(payload, subject, setPanelTitleFromGenAIResult)
      .then((response) => {
        isGenAIEnabled = response.enabled;
      })
      .catch((e) => console.log('error', e.message));
  };

  const setPanelTitleFromGenAIResult = (reply: string) => {
    // TODO: Replace this hacky implementation
    if (reply.indexOf(SPECIAL_DONE_TOKEN) >= 0) {
      reply = reply.replace(SPECIAL_DONE_TOKEN, '');
      reply = reply.replace(/"/g, '');

      setIsTitleGenerating(false);
      setPanelTitle(reply);

      return;
    }

    reply = reply.replace(/"/g, '');

    setIsTitleGenerating(true);

    if (isGenAIEnabled && reply !== '') {
      setPanelTitle(reply);
    }
  };

  return (
    <GenAIButton
      text={isTitleGenerating ? 'Generating title' : 'Generate title'}
      onClick={onGenAIButtonClick}
      loading={isTitleGenerating}
    />
  );
};
