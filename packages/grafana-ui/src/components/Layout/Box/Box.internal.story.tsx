import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';
import { Text } from '../../Text/Text';
import { Flex } from '../Flex/Flex';

import { Box, BackgroundColor, BorderColor, BorderStyle } from './Box';
import mdx from './Box.mdx';

const themeTokenControl = { control: 'select', options: [0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10] };
const backgroundOptions: BackgroundColor[] = ['primary', 'secondary', 'canvas'];
const borderColorOptions: BorderColor[] = ['weak', 'medium', 'strong', 'error', 'success', 'warning', 'info'];
const borderStyleOptions: BorderStyle[] = ['dashed', 'solid'];

const meta: Meta<typeof Box> = {
  title: 'General/Layout/Box',
  component: Box,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['element'] },
  },
};

const Item = ({ background }: { background?: string }) => {
  return (
    <div
      style={{
        width: '50px',
        height: '50px',
        background,
      }}
    />
  );
};

export const Basic: StoryFn<typeof Box> = (args) => {
  return (
    <div style={{ backgroundColor: 'green' }}>
      <Box {...args}>
        <Item background="red" />
      </Box>
    </div>
  );
};

Basic.argTypes = {
  grow: { control: 'number' },
  shrink: { control: 'number' },
  margin: themeTokenControl,
  marginX: themeTokenControl,
  marginY: themeTokenControl,
  marginTop: themeTokenControl,
  marginBottom: themeTokenControl,
  marginLeft: themeTokenControl,
  marginRight: themeTokenControl,
  padding: themeTokenControl,
  paddingX: themeTokenControl,
  paddingY: themeTokenControl,
  paddingTop: themeTokenControl,
  paddingBottom: themeTokenControl,
  paddingLeft: themeTokenControl,
  paddingRight: themeTokenControl,
  display: { control: 'select', options: ['flex', 'block', 'inline', 'none'] },
  backgroundColor: { control: 'select', options: backgroundOptions },
  borderStyle: { control: 'select', options: borderStyleOptions },
  borderColor: { control: 'select', options: borderColorOptions },
};

export const Background: StoryFn<typeof Box> = () => {
  return (
    <Flex gap={4} direction="column">
      {backgroundOptions.map((background) => (
        <Flex key={background} direction="column" alignItems="flex-start">
          {background}
          <Box backgroundColor={background} borderColor="strong" borderStyle="solid">
            <Item />
          </Box>
        </Flex>
      ))}
    </Flex>
  );
};

export const Border: StoryFn<typeof Box> = () => {
  return (
    <Flex direction="column" gap={4}>
      <div>
        <Text variant="h4">Border Color</Text>
        <Flex gap={4} wrap="wrap">
          {borderColorOptions.map((border) => (
            <Flex key={border} direction="column" alignItems="flex-start">
              {border}
              <Box borderColor={border} borderStyle="solid">
                <Item />
              </Box>
            </Flex>
          ))}
        </Flex>
      </div>
      <div>
        <Text variant="h4">Border Style</Text>
        <Flex gap={4} wrap="wrap">
          {borderStyleOptions.map((border) => (
            <Flex key={border} direction="column" alignItems="flex-start">
              {border}
              <Box borderColor="info" borderStyle={border}>
                <Item />
              </Box>
            </Flex>
          ))}
        </Flex>
      </div>
    </Flex>
  );
};

export default meta;
