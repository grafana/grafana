import { Meta, StoryFn } from '@storybook/react';
import React, { ReactNode } from 'react';

import { Alert } from '../Alert/Alert';
import { Button } from '../Button';
import { Card } from '../Card/Card';
import { Text } from '../Text/Text';

import { Stack } from './Stack';
import mdx from './Stack.mdx';

const meta: Meta<typeof Stack> = {
  title: 'General/Layout/Stack',
  component: Stack,
  // decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
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

export const TestCases: StoryFn<typeof Stack> = ({ direction = 'column', gap = 2 }) => {
  return (
    <div style={{ width: '100%' }}>
      <Stack direction="column" gap={4}>
        <Example title="No stack">
          <Button>A button</Button>
          <Button>Longer button button</Button>
        </Example>

        <Example title="Horizontal/row stack">
          <Stack direction="row">
            <Button>A button</Button>
            <Button>Longer button button</Button>
          </Stack>
        </Example>

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
        </Example>

        <Example title="Horizontal/row stack, mismatched heights">
          <Stack direction="row">
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
          </Stack>
        </Example>

        <Example title="Horizontal/row stack, mismatched heights again">
          <Stack direction="row">
            <Card>
              <Card.Heading>I am a card heading</Card.Heading>
            </Card>

            <Card>
              <Card.Heading>I am a card heading</Card.Heading>
              <Card.Description>Ohhhhh - and now a description!</Card.Description>
            </Card>

            <Alert severity="info" title="Plus an alert!" />
          </Stack>
        </Example>

        <Example title="Horizontal/row stack, alerts with even heights">
          <Stack direction="row">
            <Alert severity="info" title="Plus an alert!" />
            <Alert severity="success" title="Plus an alert!" />
            <Alert severity="warning" title="Plus an alert!" />
            <Alert severity="error" title="Plus an alert!" />
          </Stack>
        </Example>

        <Example title="Horizontal/row stack, alerts with mismatched heights">
          <Stack direction="row">
            <Alert severity="info" title="Plus an alert!" />
            <Alert severity="success" title="Plus an alert!" />
            <Alert severity="warning" title="Plus an alert!">
              Surprise - a description! What will happen to the height of all the other alerts?
            </Alert>
            <Alert severity="error" title="Plus an alert!" />
          </Stack>
        </Example>

        <div style={{ width: 500 }}>
          <Example title="No stack, too many items">
            <Button>A button</Button>
            <Button>Longer button button</Button>
            <Button>Another button</Button>
            <Button>And another</Button>
            <Button>Why not - one last button!</Button>
          </Example>

          <Example title="Horizontal/row stack, too many items">
            <Stack direction="row">
              <Button>A button</Button>
              <Button>Longer button button</Button>
              <Button>Another button</Button>
              <Button>And another</Button>
              <Button>Why not - one last button!</Button>
            </Stack>
          </Example>
        </div>

        <Example title="Vertical/column stack">
          <Stack direction="column">
            <Button>A button</Button>
            <Button>Longer button button</Button>
          </Stack>
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

export default meta;
