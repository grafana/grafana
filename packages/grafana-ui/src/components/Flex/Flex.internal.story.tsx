import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { useTheme2 } from '../../themes';
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
      {text && <h3 style={{ color: 'black' }}>{text}</h3>}
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

export const Basic: StoryFn<typeof Flex> = ({ direction, wrap, alignItems, justifyContent, gap }) => {
  const theme = useTheme2();
  return (
    <div style={{ width: '600px', height: '600px', border: '1px solid grey' }}>
      <Flex direction={direction} wrap={wrap} alignItems={alignItems} justifyContent={justifyContent} gap={gap}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.warning.main} text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export const AlignItemsExamples: StoryFn<typeof Flex> = () => {
  const theme = useTheme2();
  return (
    <div style={{ width: '600px' }}>
      <p>Align items flex-start</p>
      <Flex direction="row" wrap="wrap" alignItems="flex-start" justifyContent="start" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
      <p>Align items flex-end</p>
      <Flex direction="row" wrap="wrap" alignItems="flex-end" justifyContent="end" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
      <p>Align items stretch</p>
      <Flex direction="row" wrap="wrap" alignItems="stretch" justifyContent="center" gap={2}>
        <Item color={theme.colors.error.main} height="10em" />
        <Item color={theme.colors.error.main} />
        <Item color={theme.colors.error.main} height="3em" />
        <Item color={theme.colors.error.main} />
        <Item color={theme.colors.error.main} />
      </Flex>

      <p>Align items baseline</p>
      <Flex direction="row" wrap="nowrap" alignItems="baseline" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
      <p>Align items center</p>
      <Flex direction="row" wrap="wrap" alignItems="center" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export const JustifyContentExamples: StoryFn<typeof Flex> = () => {
  const theme = useTheme2();
  return (
    <div style={{ width: '600px' }}>
      <p>Justify Content space-between</p>
      <Flex direction="row" wrap="wrap" alignItems="center" justifyContent="space-between" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.warning.main} text={i + 1} />
        ))}
      </Flex>
      <p>Justify Content space-around </p>
      <Flex direction="row" wrap="wrap" alignItems="center" justifyContent="space-around" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.warning.main} text={i + 1} />
        ))}
      </Flex>
      <p>Justify Content space-evenly</p>
      <Flex direction="row" wrap="wrap" alignItems="center" justifyContent="space-evenly" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.warning.main} text={i + 1} />
        ))}
      </Flex>
      <p>Justify Content flex-start</p>
      <Flex direction="row" wrap="wrap" alignItems="center" justifyContent="flex-start" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.warning.main} text={i + 1} />
        ))}
      </Flex>
      <p>Justify Content flex-end</p>
      <Flex direction="row" wrap="wrap" alignItems="center" justifyContent="flex-end" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.warning.main} text={i + 1} />
        ))}
      </Flex>
      <p>Justify Content center</p>
      <Flex direction="row" wrap="wrap" alignItems="center" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.warning.main} text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export const GapExamples: StoryFn<typeof Flex> = () => {
  const theme = useTheme2();
  return (
    <div style={{ width: '800px' }}>
      <p>Gap with spacingToken set to 2 (16px)</p>
      <Flex direction="row" wrap="wrap" alignItems="flex-start" justifyContent="flex-start" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
      <p>Gap with spacingToken set to 8 (64px)</p>
      <Flex direction="row" wrap="wrap" alignItems="flex-start" justifyContent="flex-start" gap={8}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
      <p>Gap with spacingToken set to 10 (80px)</p>
      <Flex direction="row" wrap="wrap" alignItems="flex-start" justifyContent="flex-start" gap={10}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export const WrapExamples: StoryFn<typeof Flex> = () => {
  const theme = useTheme2();
  return (
    <div style={{ width: '600px' }}>
      <p>Wrap example with wrap and gap set to spacingToken 2 (16px)</p>
      <Flex direction="row" wrap="wrap" alignItems="center" justifyContent="center" gap={2}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Item key={i} color={theme.colors.warning.main} text={i + 1} />
        ))}
      </Flex>
      <p>Wrap example with wrap-reverse and gap set to spacingToken 2 (16px)</p>
      <Flex direction="row" wrap="wrap-reverse" alignItems="center" justifyContent="center" gap={2}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Item key={i} color={theme.colors.warning.main} text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export const DirectionExamples: StoryFn<typeof Flex> = () => {
  const theme = useTheme2();
  return (
    <div style={{ width: '600px' }}>
      <p>Direction row</p>
      <Flex direction="row" wrap="wrap" alignItems="flex-start" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
      <p>Direction row-reverse</p>
      <Flex direction="row-reverse" wrap="wrap" alignItems="flex-start" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
      <p>Direction column</p>
      <Flex direction="column" wrap="wrap" alignItems="flex-start" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
      <p>Direction column-reverse</p>
      <Flex direction="column-reverse" wrap="wrap" alignItems="flex-start" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Flex>
    </div>
  );
};

export default meta;
