import React, { useState } from 'react';

import { PanelModel } from '@grafana/data';

import { GenAIButton } from './GenAIButton';
import {
  getGeneratePayloadForPanelTitleAndDescription,
  onGenerateTextWithAI,
  SPECIAL_DONE_TOKEN,
} from './GenAIService';

interface GenAIPanelDescriptionProps {
  setPanelDescription: (description: string) => void;
  panel: PanelModel;
}

export const GenAIPanelDescription = ({ setPanelDescription, panel }: GenAIPanelDescriptionProps) => {
  const [isDescriptionGenerating, setIsDescriptionGenerating] = useState(false);

  // TODO: Figure out better state management for this possibly (useState results in stale value on first run)
  let isGenAIEnabled = false;

  const onGenAIButtonClick = () => {
    // TODO: Improve this to be enum or some other way of handling
    generateAIDescriptionResult('description');
  };

  const generateAIDescriptionResult = (subject: string) => {
    const payload = getGeneratePayloadForPanelTitleAndDescription(panel);

    onGenerateTextWithAI(payload, subject, setPanelDescriptionFromGenAIResult)
      .then((response) => {
        isGenAIEnabled = response.enabled;
      })
      .catch((e) => console.log('error', e.message));
  };

  const setPanelDescriptionFromGenAIResult = (reply: string) => {
    // TODO: Replace this hacky implementation
    if (reply.indexOf(SPECIAL_DONE_TOKEN) >= 0) {
      reply = reply.replace(SPECIAL_DONE_TOKEN, '');
      reply = reply.replace(/"/g, '');

      setIsDescriptionGenerating(false);
      setPanelDescription(reply);

      return;
    }

    reply = reply.replace(/"/g, '');

    setIsDescriptionGenerating(true);

    if (isGenAIEnabled && reply !== '') {
      setPanelDescription(reply);
    }
  };

  return (
    <GenAIButton
      text={isDescriptionGenerating ? 'Generating description' : 'Generate description'}
      onClick={onGenAIButtonClick}
      loading={isDescriptionGenerating}
    />
  );
};
