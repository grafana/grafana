import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { SpacingTokenControl } from '../../../utils/storybook/themeStorybookControls';
import { Text } from '../../Text/Text';
import { Flex } from '../Flex/Flex';

import { Box, BackgroundColor, BorderColor, BorderStyle, BorderRadius, BoxShadow } from './Box';
import mdx from './Box.mdx';

const backgroundOptions: BackgroundColor[] = ['primary', 'secondary', 'canvas', 'error', 'success', 'warning', 'info'];
const borderColorOptions: BorderColor[] = ['weak', 'medium', 'strong', 'error', 'success', 'warning', 'info'];
const borderStyleOptions: BorderStyle[] = ['dashed', 'solid'];
const borderRadiusOptions: BorderRadius[] = ['default', 'pill', 'circle'];
const boxShadowOptions: BoxShadow[] = ['z1', 'z2', 'z3'];

const meta: Meta<typeof Box> = {
  title: 'General/Layout/Box',
  component: Box,
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
  margin: SpacingTokenControl,
  marginX: SpacingTokenControl,
  marginY: SpacingTokenControl,
  marginTop: SpacingTokenControl,
  marginBottom: SpacingTokenControl,
  marginLeft: SpacingTokenControl,
  marginRight: SpacingTokenControl,
  padding: SpacingTokenControl,
  paddingX: SpacingTokenControl,
  paddingY: SpacingTokenControl,
  paddingTop: SpacingTokenControl,
  paddingBottom: SpacingTokenControl,
  paddingLeft: SpacingTokenControl,
  paddingRight: SpacingTokenControl,
  display: { control: 'select', options: ['flex', 'block', 'inline', 'none'] },
  backgroundColor: { control: 'select', options: backgroundOptions },
  borderStyle: { control: 'select', options: borderStyleOptions },
  borderColor: { control: 'select', options: borderColorOptions },
  borderRadius: { control: 'select', options: borderRadiusOptions },
  boxShadow: { control: 'select', options: boxShadowOptions },
};

export const Background: StoryFn<typeof Box> = () => {
  return (
    <Flex gap={4}>
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

export const Shadow: StoryFn<typeof Box> = () => {
  return (
    <Flex gap={4}>
      {boxShadowOptions.map((shadow) => (
        <Flex key={shadow} direction="column" alignItems="flex-start">
          {shadow}
          <Box boxShadow={shadow} borderColor="strong" borderStyle="solid">
            <Item />
          </Box>
        </Flex>
      ))}
    </Flex>
  );
};

export default meta;
