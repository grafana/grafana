import { Meta, StoryFn } from '@storybook/react';
import React, { ReactNode } from 'react';

import { SpacingTokenControl } from '../../../utils/storybook/themeStorybookControls';
import { Alert } from '../../Alert/Alert';
import { Button } from '../../Button';
import { Card } from '../../Card/Card';
import { Text } from '../../Text/Text';

import { HorizontalStack } from './HorizontalStack';
import { Stack } from './Stack';
import mdx from './Stack.mdx';

const meta: Meta<typeof Stack> = {
  title: 'General/Layout/Stack',
  component: Stack,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    gap: SpacingTokenControl,
    direction: { control: 'select', options: ['row', 'column'] },
  },
};

const Item = ({ children }: { children: ReactNode }) => (
  <div style={{ backgroundColor: 'lightgrey', width: '100px', height: '50px' }}>{children}</div>
);

export const Basic: StoryFn<typeof Stack> = ({ direction = 'column', gap = 2 }) => {
  return (
    <Stack direction={direction} gap={gap}>
      <Item>Item 1</Item>
      <Item>Item 2</Item>
      <Item>Item 3</Item>
    </Stack>
  );
};

export const TestCases: StoryFn<typeof Stack> = () => {
  return (
    <div style={{ width: '100%' }}>
      <Stack gap={4}>
        <h2>Comparisons Stack vs No stack</h2>
        <HorizontalStack>
          <Example title="No stack">
            <Button>A button</Button>
            <Button>Longer button button</Button>
          </Example>

          <Example title="Horizontal stack">
            <HorizontalStack>
              <Button>A button</Button>
              <Button>Longer button button</Button>
            </HorizontalStack>
          </Example>

          <Example title="Vertical stack">
            <Stack>
              <Button>A button</Button>
              <Button>Longer button button</Button>
            </Stack>
          </Example>
        </HorizontalStack>

        <HorizontalStack>
          <Example title="No stack, mismatched heights">
            <Card>
              <Card.Heading>I am a card heading</Card.Heading>
            </Card>

            <Card>
              <Card.Heading>I am a card heading</Card.Heading>
              <Card.Description>Ohhhhh - and now a description and some actions</Card.Description>
              <Card.Actions>
                <Button variant="secondary">Settings</Button>
                <Button variant="secondary">Explore</Button>
              </Card.Actions>
            </Card>

            <Card>
              <Card.Heading>I am a card heading</Card.Heading>
              <Card.Description>Ohhhhh - and now a description!</Card.Description>
            </Card>
            <Button>Please press me!</Button>
          </Example>
          <Example title="Vertical stack, mismatched heights">
            <Stack>
              <Card>
                <Card.Heading>I am a card heading</Card.Heading>
              </Card>

              <Card>
                <Card.Heading>I am a card heading</Card.Heading>
                <Card.Description>Ohhhhh - and now a description and some actions</Card.Description>
                <Card.Actions>
                  <Button variant="secondary">Settings</Button>
                  <Button variant="secondary">Explore</Button>
                </Card.Actions>
              </Card>

              <Card>
                <Card.Heading>I am a card heading</Card.Heading>
                <Card.Description>Ohhhhh - and now a description!</Card.Description>
              </Card>
              <Button>Please press me!</Button>
            </Stack>
          </Example>
        </HorizontalStack>

        <div style={{ width: 500 }}>
          <Example title="No stack, too many items">
            <Button>A button</Button>
            <Button>Longer button button</Button>
            <Button>Another button</Button>
            <Button>And another</Button>
            <Button>Why not - one last button!</Button>
          </Example>

          <Example title="Horizontal stack, too many items">
            <HorizontalStack>
              <Button>A button</Button>
              <Button>Longer button button</Button>
              <Button>Another button</Button>
              <Button>And another</Button>
              <Button>Why not - one last button!</Button>
            </HorizontalStack>
          </Example>
        </div>

        <h2>Child alignment</h2>

        <div style={{ width: 500 }}>
          <Example title="Row, mismatched heights">
            <HorizontalStack>
              <MyComponent>
                <div style={{ height: 50, width: 100, background: 'blue' }} />
              </MyComponent>
              <MyComponent>
                <div style={{ height: 150, width: 100, background: 'orange' }} />
              </MyComponent>
            </HorizontalStack>
          </Example>
        </div>

        <Example title="Horizontal stack, mismatched heights">
          <HorizontalStack>
            <Card>
              <Card.Heading>I am a card heading</Card.Heading>
            </Card>

            <Card>
              <Card.Heading>I am a card heading</Card.Heading>
              <Card.Description>Ohhhhh - and now a description and some actions</Card.Description>
              <Card.Actions>
                <Button variant="secondary">Settings</Button>
                <Button variant="secondary">Explore</Button>
              </Card.Actions>
            </Card>

            <Card>
              <Card.Heading>I am a card heading</Card.Heading>
              <Card.Description>Ohhhhh - and now a description!</Card.Description>
            </Card>
          </HorizontalStack>
        </Example>

        <Example title="Horizontal stack, mismatched heights with different components">
          <HorizontalStack>
            <Card>
              <Card.Heading>I am a card heading</Card.Heading>
            </Card>

            <Card>
              <Card.Heading>I am a card heading</Card.Heading>
              <Card.Description>Ohhhhh - and now a description!</Card.Description>
            </Card>

            <Alert severity="info" title="Plus an alert!" />
          </HorizontalStack>
        </Example>

        <Example title="Horizontal stack, alerts with even heights">
          <HorizontalStack>
            <Alert severity="info" title="Plus an alert!" />
            <Alert severity="success" title="Plus an alert!" />
            <Alert severity="warning" title="Plus an alert!" />
            <Alert severity="error" title="Plus an alert!" />
          </HorizontalStack>
        </Example>

        <Example title="Horizontal stack, alerts with mismatched heights">
          <HorizontalStack>
            <Alert severity="info" title="Plus an alert!" />
            <Alert severity="success" title="Plus an alert!" />
            <Alert severity="warning" title="Plus an alert!">
              Surprise - a description! What will happen to the height of all the other alerts?
            </Alert>
            <Alert severity="error" title="Plus an alert!" />
          </HorizontalStack>
        </Example>
      </Stack>
    </div>
  );
};

function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <Text variant="h3">{title}</Text>
      <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px dashed green' }}>{children}</div>
    </div>
  );
}

function MyComponent({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'rgba(0,255,255, 0.2)', padding: 16 }}>{children}</div>;
}

export default meta;
