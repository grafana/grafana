import React from 'react';

import { Button, Stack, Text } from '@grafana/ui';

import { Card, SetupStep, TutorialCardType } from '../types';

import { DocsCard } from './DocsCard';
import { TutorialCard } from './TutorialCard';

interface StepProps {
  step: SetupStep;
  onDismiss: () => void;
}

interface SetupCardProps {
  card: Card | TutorialCardType;
}

export function SetupCard({ card }: SetupCardProps) {
  if (card.type === 'tutorial') {
    return <TutorialCard card={card} />;
  }

  return <DocsCard card={card} />;
}

export const Step = ({ step, onDismiss }: StepProps) => {
  return (
    <Stack gap={2} direction="column">
      <Stack justifyContent="space-between">
        <Stack direction="column">
          <Text variant="h4">{step.title}</Text>
          <Text>{step.info}</Text>
        </Stack>

        <Button variant="secondary" fill="text" onClick={onDismiss}>
          Remove this panel
        </Button>
      </Stack>

      <Stack gap={4} direction="row" grow={1}>
        {step.cards.map((card, index) => {
          return <SetupCard key={index} card={card} />;
        })}
      </Stack>
    </Stack>
  );
};
