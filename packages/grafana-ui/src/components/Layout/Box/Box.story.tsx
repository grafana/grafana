import { Meta, StoryFn } from '@storybook/react';

import { SpacingTokenControl } from '../../../utils/storybook/themeStorybookControls';
import { Text } from '../../Text/Text';
import { Stack } from '../Stack/Stack';

import { Box, BackgroundColor, BorderColor, BorderStyle, BorderRadius, BoxShadow } from './Box';
import mdx from './Box.mdx';

const backgroundOptions: BackgroundColor[] = ['primary', 'secondary', 'canvas', 'error', 'success', 'warning', 'info'];
const borderColorOptions: Array<BorderColor | undefined> = [
  'weak',
  'medium',
  'strong',
  'error',
  'success',
  'warning',
  'info',
  undefined,
];
const borderStyleOptions: Array<BorderStyle | undefined> = ['dashed', 'solid', undefined];
const borderRadiusOptions: BorderRadius[] = ['default', 'pill', 'circle'];
const boxShadowOptions: BoxShadow[] = ['z1', 'z2', 'z3'];

const meta: Meta<typeof Box> = {
  title: 'Layout/Box',
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
    <Stack>
      <Box borderColor="medium" {...args}>
        Box
      </Box>
    </Stack>
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
  direction: { control: 'select', options: ['row', 'row-reverse', 'column', 'column-reverse'] },
  display: { control: 'select', options: ['flex', 'block', 'inline', 'none'] },
  backgroundColor: { control: 'select', options: backgroundOptions },
  borderStyle: { control: 'select', options: borderStyleOptions },
  borderColor: { control: 'select', options: borderColorOptions },
  borderRadius: { control: 'select', options: borderRadiusOptions },
  boxShadow: { control: 'select', options: boxShadowOptions },
};

Basic.args = {
  borderColor: 'medium',
  borderStyle: 'solid',
};

export const Background: StoryFn<typeof Box> = () => {
  return (
    <Stack gap={4}>
      {backgroundOptions.map((background) => (
        <Stack key={background} direction="column" alignItems="flex-start">
          {background}
          <Box backgroundColor={background} borderColor="strong" borderStyle="solid">
            <Item />
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};

export const Border: StoryFn<typeof Box> = () => {
  return (
    <Stack direction="column" gap={4}>
      <div>
        <Text variant="h4">Border Color</Text>
        <Stack gap={4} wrap="wrap">
          {borderColorOptions.map((border) => (
            <Stack key={border} direction="column" alignItems="flex-start">
              {border}
              <Box borderColor={border} borderStyle="solid">
                <Item />
              </Box>
            </Stack>
          ))}
        </Stack>
      </div>
      <div>
        <Text variant="h4">Border Style</Text>
        <Stack gap={4} wrap="wrap">
          {borderStyleOptions.map((border) => (
            <Stack key={border} direction="column" alignItems="flex-start">
              {border}
              <Box borderColor="info" borderStyle={border}>
                <Item />
              </Box>
            </Stack>
          ))}
        </Stack>
      </div>
    </Stack>
  );
};

export const Shadow: StoryFn<typeof Box> = () => {
  return (
    <Stack gap={4}>
      {boxShadowOptions.map((shadow) => (
        <Stack key={shadow} direction="column" alignItems="flex-start">
          {shadow}
          <Box boxShadow={shadow} borderColor="strong" borderStyle="solid">
            <Item />
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};

export default meta;
