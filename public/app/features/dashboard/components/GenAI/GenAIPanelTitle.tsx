import React, { useState } from 'react';

import { GenAIButton } from './GenAIButton';

interface GenAIPanelTitleProps {
  setPanelTitle: (title: string) => void;
}

export const GenAIPanelTitle = ({ setPanelTitle }: GenAIPanelTitleProps) => {
  const [isTitleGenerating, setIsTitleGenerating] = useState(false);
  const [genAITitleResult, setGenAITitleResult] = useState('');

  const onGenAIButtonClick = () => {
    setIsTitleGenerating(true);
    console.log('generating... ', genAITitleResult);
    setTimeout(() => setIsTitleGenerating(false), 3000);
  };

  return (
    <GenAIButton
      text={isTitleGenerating ? 'Generating title' : 'Generate title'}
      onClick={onGenAIButtonClick}
      loading={isTitleGenerating}
    />
  );
};
