import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { useTheme2 } from '../../../themes';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

import { Flex, JustifyContent, Wrap, Direction } from './Flex';
import mdx from './Flex.mdx';

const themeTokenControl = { control: 'select', options: [0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10] };

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
  title: 'General/Layout/Flex',
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

Basic.argTypes = {
  gap: themeTokenControl,
  direction: { control: 'select', options: ['row', 'row-reverse', 'column', 'column-reverse'] },
  wrap: { control: 'select', options: ['nowrap', 'wrap', 'wrap-reverse'] },
  alignItems: {
    control: 'select',
    options: ['stretch', 'flex-start', 'flex-end', 'center', 'baseline', 'start', 'end', 'self-start', 'self-end'],
  },
  justifyContent: {
    control: 'select',
    options: [
      'flex-start',
      'flex-end',
      'center',
      'space-between',
      'space-around',
      'space-evenly',
      'start',
      'end',
      'left',
      'right',
    ],
  },
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
      <p>Align items stretch</p>
      <Flex direction="row" wrap="wrap" alignItems="stretch" justifyContent="center" gap={2}>
        <Item color={theme.colors.error.main} height="10em" />
        <Item color={theme.colors.error.main} />
        <Item color={theme.colors.error.main} height="3em" />
        <Item color={theme.colors.error.main} />
        <Item color={theme.colors.error.main} />
      </Flex>
    </div>
  );
};

export const JustifyContentExamples: StoryFn<typeof Flex> = () => {
  const theme = useTheme2();
  const justifyContentOptions: JustifyContent[] = [
    'space-between',
    'space-around',
    'space-evenly',
    'flex-start',
    'flex-end',
    'center',
  ];

  return (
    <div style={{ width: '600px' }}>
      {justifyContentOptions.map((justifyContent) => (
        <>
          <p>Justify Content {justifyContent}</p>
          <Flex direction="row" wrap="wrap" alignItems="center" justifyContent={justifyContent} gap={2}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Item key={i} color={theme.colors.warning.main} text={i + 1} />
            ))}
          </Flex>
        </>
      ))}
    </div>
  );
};

export const GapExamples: StoryFn<typeof Flex> = () => {
  const theme = useTheme2();
  const gapOptions: ThemeSpacingTokens[] = [2, 8, 10];
  return (
    <div style={{ width: '800px' }}>
      {gapOptions.map((gap) => (
        <>
          <p>Gap with spacingToken set to {gap}</p>
          <Flex direction="row" wrap="wrap" alignItems="flex-start" justifyContent="flex-start" gap={gap}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Item key={i} color={theme.colors.error.main} text={i + 1} />
            ))}
          </Flex>
        </>
      ))}
    </div>
  );
};

export const WrapExamples: StoryFn<typeof Flex> = () => {
  const theme = useTheme2();
  const wrapOptions: Wrap[] = ['nowrap', 'wrap', 'wrap-reverse'];
  return (
    <div style={{ width: '600px' }}>
      {wrapOptions.map((wrap) => (
        <>
          <p>Wrap examples with {wrap} and gap set to spacingToken 2 (16px)</p>
          <Flex direction="row" wrap={wrap} alignItems="center" justifyContent="center" gap={2}>
            {Array.from({ length: 10 }).map((_, i) => (
              <Item key={i} color={theme.colors.warning.main} text={i + 1} />
            ))}
          </Flex>
        </>
      ))}
    </div>
  );
};

export const DirectionExamples: StoryFn<typeof Flex> = () => {
  const theme = useTheme2();
  const directionOptions: Direction[] = ['row', 'row-reverse', 'column', 'column-reverse'];
  return (
    <div style={{ width: '600px' }}>
      {directionOptions.map((direction) => (
        <>
          <p>Direction {direction}</p>
          <Flex direction={direction} wrap="wrap" alignItems="center" justifyContent="center" gap={2}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Item key={i} color={theme.colors.warning.main} text={i + 1} />
            ))}
          </Flex>
        </>
      ))}
    </div>
  );
};

export default meta;
