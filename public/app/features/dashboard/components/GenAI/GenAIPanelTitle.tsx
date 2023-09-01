import React, { useState } from 'react';

import { GenAIButton } from './GenAIButton';

export const GenAIPanelTitle = () => {
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
