import React from 'react';

import { Stack, Text } from '@grafana/ui';

import { Card, SetupStep, TutorialCardType } from '../types';

import { DocsCard } from './DocsCard';
import { TutorialCard } from './TutorialCard';

interface Props {
  step: SetupStep;
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

export const Step = ({ step }: Props) => {
  return (
    <Stack gap={2} direction="column">
      <Stack direction="column">
        <Text variant="h4">{step.title}</Text>
        <Text>{step.info}</Text>
      </Stack>

      <Stack gap={4} direction="row">
        {step.cards.map((card, index) => {
          return <SetupCard key={index} card={card} />;
        })}
      </Stack>
    </Stack>
  );
};
