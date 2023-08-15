import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { Text } from '../../components/Text/Text';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Flex } from './Flex';
import mdx from './Flex.mdx';

const Item = ({ color, text, height }: { color: string; text?: string | number; height?: string }) => {
  return (
    <div
      style={{
        width: '5em',
        height: height,
        backgroundColor: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {text && (
        <Text color="info" variant="h2">
          {text}
        </Text>
      )}
    </div>
  );
};

const meta: Meta<typeof Flex> = {
  title: 'General/Flex',
  component: Flex,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: StoryFn<typeof Flex> = ({ flexFlow, alignItems, justifyContent, gap }) => {
  return (
    <Flex flexFlow={flexFlow} alignItems={alignItems} justifyContent={justifyContent} gap={gap}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Item key={i} color="pink" text={i + 1} />
      ))}
    </Flex>
  );
};

export const AlignItemsExamples: StoryFn<typeof Flex> = () => {
  return (
    <div>
      <p>Align items flex-start</p>
      <Flex flexFlow="row wrap" alignItems="flex-start" justifyContent="start" gap={2}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Item key={i} color="pink" text={i + 1} />
        ))}
      </Flex>
      <p>Align items flex-end</p>
      <Flex flexFlow="row wrap" alignItems="flex-end" justifyContent="end" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
      <p>Align items stretch</p>
      <Flex flexFlow="row wrap" alignItems="stretch" justifyContent="center" gap={2}>
        <Item color="pink" height="10em" />
        <Item color="darkmagenta" />
        <Item color="pink" height="3em" />
        <Item color="darkmagenta" />
      </Flex>

      <p>Align items baseline</p>
      <Flex flexFlow="row nowrap" alignItems="baseline" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color="pink" text={i + 1} />
        ))}
      </Flex>
      <p>Align items center</p>
      <Flex flexFlow="row wrap" alignItems="center" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color="pink" text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export const JustifyContentExamples: StoryFn<typeof Flex> = () => {
  return (
    <div>
      <p>Justify Content space-between</p>
      <Flex flexFlow="row wrap" alignItems="center" justifyContent="space-between" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
      <p>Justify Content space-around </p>
      <Flex flexFlow="row wrap" alignItems="center" justifyContent="space-around" gap={2}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
      <p>Justify Content space-evenly</p>
      <Flex flexFlow="row wrap" alignItems="center" justifyContent="space-evenly" gap={2}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
      <p>Justify Content flex-start</p>
      <Flex flexFlow="row wrap" alignItems="center" justifyContent="flex-start" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
      <p>Justify Content flex-end</p>
      <Flex flexFlow="row wrap" alignItems="center" justifyContent="flex-end" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
      <p>Justify Content center</p>
      <Flex flexFlow="row wrap" alignItems="center" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export const GapExamples: StoryFn<typeof Flex> = () => {
  return (
    <div>
      <p>Gap with spacingToken set to 2 (16px)</p>
      <Flex flexFlow="row wrap" alignItems="flex-start" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
      <p>Gap with spacingToken set to 8 (64px)</p>
      <Flex flexFlow="row wrap" alignItems="flex-start" justifyContent="center" gap={8}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
      <p>Gap with spacingToken set to 10 (80px)</p>
      <Flex flexFlow="row wrap" alignItems="flex-start" justifyContent="center" gap={10}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export const WrapExamples: StoryFn<typeof Flex> = () => {
  return (
    <div>
      <p>Wrap example with wrap and gap set to spacingToken 8 (64px)</p>
      <Flex flexFlow="row wrap" alignItems="center" justifyContent="center" gap={8}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Item key={i} color="pink" text={i + 1} />
        ))}
      </Flex>
      <p>Wrap example with wrap-reverse and gap set to spacingToken 4 (32px)</p>
      <Flex flexFlow="row wrap-reverse" alignItems="center" justifyContent="center" gap={4}>
        {Array.from({ length: 15 }).map((_, i) => (
          <Item key={i} color="pink" text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export const DirectionExamples: StoryFn<typeof Flex> = () => {
  return (
    <div>
      <p>Direction row</p>
      <Flex flexFlow="row wrap" alignItems="flex-start" justifyContent="center" gap={2}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
      <p>Direction row-reverse</p>
      <Flex flexFlow="row-reverse wrap" alignItems="flex-start" justifyContent="center" gap={2}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Item key={i} color="darkmagenta" text={i + 1} />
        ))}
      </Flex>
      <p>Direction column</p>
      <Flex flexFlow="column wrap" alignItems="flex-start" justifyContent="center" gap={2}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Item key={i} color="pink" text={i + 1} />
        ))}
      </Flex>
      <p>Direction column-reverse</p>
      <Flex flexFlow="column-reverse wrap" alignItems="flex-start" justifyContent="center" gap={2}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Item key={i} color="pink" text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export default meta;
