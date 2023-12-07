import React from 'react';

import { Stack } from '@grafana/ui';

import { AskAQuestion } from './AskAQuestion';
import { SuggestionContainer } from './SuggestionContainer';
import { Tutorial } from './state/state';
import { Interaction, SuggestionType } from './types';

type WizardDSInteractionProps = {
  'data-testid': string;
  interaction: Interaction;
  onExplain: (suggIdx: number) => void;
  onCancel: () => void;
  onChange: (prompt: string) => void;
  onSubmit: (prompt: string) => void;
  onNextInteraction: () => void;
  tutorial: Tutorial;
};

export const WizardDSInteraction = ({
  'data-testid': dataTestId,
  interaction,
  onCancel,
  onChange,
  onExplain,
  onSubmit,
  onNextInteraction,
  tutorial,
}: WizardDSInteractionProps) => {
  const isLoading = interaction.isLoading;
  const hasSuggestions = interaction.suggestions.length !== 0;
  const prompt = interaction.prompt ?? '';

  return (
    <Stack direction={'column'} gap={2}>
      <AskAQuestion
        data-testid={dataTestId}
        isDisabled={hasSuggestions || isLoading}
        isLoading={isLoading}
        onChange={onChange}
        onSubmit={onSubmit}
        value={prompt}
      />
      {hasSuggestions && (
        <SuggestionContainer
          suggestionType={SuggestionType.AI}
          suggestions={interaction.suggestions}
          closeDrawer={onCancel}
          nextInteraction={onNextInteraction}
          explain={onExplain}
          prompt={interaction.prompt ?? ''}
          tutorial={tutorial}
        />
      )}
    </Stack>
  );
};
