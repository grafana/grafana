import { Meta, StoryFn } from '@storybook/react';

import { ThemeSpacingTokens } from '@grafana/data';

import { useTheme2 } from '../../../themes/ThemeContext';
import { SpacingTokenControl } from '../../../utils/storybook/themeStorybookControls';
import { JustifyContent, Wrap, Direction } from '../types';

import { Stack } from './Stack';
import mdx from './Stack.mdx';

const meta: Meta<typeof Stack> = {
  title: 'Layout/Stack',
  component: Stack,
  parameters: {
    docs: {
      page: mdx,
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
};

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

export const Basic: StoryFn<typeof Stack> = (args) => {
  const theme = useTheme2();
  return (
    <div style={{ width: '600px', height: '600px', border: '1px solid grey' }}>
      <Stack {...args}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.warning.main} text={i + 1} />
        ))}
      </Stack>
    </div>
  );
};

Basic.argTypes = {
  gap: SpacingTokenControl,
  rowGap: SpacingTokenControl,
  columnGap: SpacingTokenControl,
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

export const AlignItemsExamples: StoryFn<typeof Stack> = () => {
  const theme = useTheme2();

  return (
    <div style={{ width: '600px' }}>
      <p>Align items flex-start</p>
      <Stack direction="row" wrap alignItems="flex-start" justifyContent="start" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Stack>
      <p>Align items flex-end</p>
      <Stack direction="row" wrap alignItems="flex-end" justifyContent="end" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Stack>
      <p>Align items baseline</p>
      <Stack direction="row" wrap="nowrap" alignItems="baseline" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Stack>
      <p>Align items center</p>
      <Stack direction="row" wrap alignItems="center" justifyContent="center" gap={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Item key={i} color={theme.colors.error.main} text={i + 1} />
        ))}
      </Stack>
      <p>Align items stretch</p>
      <Stack direction="row" wrap alignItems="stretch" justifyContent="center" gap={2}>
        <Item color={theme.colors.error.main} height="10em" />
        <Item color={theme.colors.error.main} />
        <Item color={theme.colors.error.main} height="3em" />
        <Item color={theme.colors.error.main} />
        <Item color={theme.colors.error.main} />
      </Stack>
    </div>
  );
};

export const JustifyContentExamples: StoryFn<typeof Stack> = () => {
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
          <Stack direction="row" wrap alignItems="center" justifyContent={justifyContent} gap={2}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Item key={i} color={theme.colors.warning.main} text={i + 1} />
            ))}
          </Stack>
        </>
      ))}
    </div>
  );
};

export const GapExamples: StoryFn<typeof Stack> = () => {
  const theme = useTheme2();
  const gapOptions: ThemeSpacingTokens[] = [2, 8, 10];
  return (
    <div style={{ width: '800px' }}>
      {gapOptions.map((gap) => (
        <>
          <p>Gap with spacingToken set to {gap}</p>
          <Stack direction="row" wrap alignItems="flex-start" justifyContent="flex-start" gap={gap}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Item key={i} color={theme.colors.error.main} text={i + 1} />
            ))}
          </Stack>
        </>
      ))}
    </div>
  );
};

export const WrapExamples: StoryFn<typeof Stack> = () => {
  const theme = useTheme2();
  const wrapOptions: Wrap[] = ['nowrap', 'wrap', 'wrap-reverse'];
  return (
    <div style={{ width: '600px' }}>
      {wrapOptions.map((wrap) => (
        <>
          <p>Wrap examples with {wrap} and gap set to spacingToken 2 (16px)</p>
          <Stack direction="row" wrap={wrap} alignItems="center" justifyContent="center" gap={2}>
            {Array.from({ length: 10 }).map((_, i) => (
              <Item key={i} color={theme.colors.warning.main} text={i + 1} />
            ))}
          </Stack>
        </>
      ))}
    </div>
  );
};

export const DirectionExamples: StoryFn<typeof Stack> = () => {
  const theme = useTheme2();
  const directionOptions: Direction[] = ['row', 'row-reverse', 'column', 'column-reverse'];
  return (
    <div style={{ width: '600px' }}>
      {directionOptions.map((direction) => (
        <>
          <p>Direction {direction}</p>
          <Stack direction={direction} wrap alignItems="center" justifyContent="center" gap={2}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Item key={i} color={theme.colors.warning.main} text={i + 1} />
            ))}
          </Stack>
        </>
      ))}
    </div>
  );
};

export default meta;
