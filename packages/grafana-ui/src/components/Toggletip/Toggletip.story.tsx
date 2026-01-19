import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { Button } from '../Button/Button';
import { Drawer } from '../Drawer/Drawer';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';
import { Modal } from '../Modal/Modal';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';
import mdx from '../Toggletip/Toggletip.mdx';

import { Toggletip } from './Toggletip';

const meta: Meta<typeof Toggletip> = {
  title: 'Overlays/Toggletip',
  component: Toggletip,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['children'],
    },
  },
  argTypes: {
    title: {
      control: {
        type: 'text',
      },
    },
    content: {
      control: {
        type: 'text',
      },
    },
    footer: {
      control: {
        type: 'text',
      },
    },
    theme: {
      control: {
        type: 'select',
      },
    },
    closeButton: {
      control: {
        type: 'boolean',
      },
    },
    placement: {
      control: {
        type: 'select',
      },
    },
  },
};

export const Basic: StoryFn<typeof Toggletip> = ({
  title,
  content,
  footer,
  theme,
  closeButton,
  placement,
  ...args
}) => {
  return (
    <Toggletip
      title={title}
      content={content}
      footer={footer}
      theme={theme}
      closeButton={closeButton}
      placement={placement}
      {...args}
    >
      <Button>Click to show Toggletip with header and footer!</Button>
    </Toggletip>
  );
};
Basic.args = {
  title: 'Title of the Toggletip',
  content: 'This is the content of the Toggletip',
  footer: 'Footer of the Toggletip',
  placement: 'auto',
  closeButton: true,
  theme: 'info',
};

export const LongContent: StoryFn<typeof Toggletip> = ({
  title,
  content,
  footer,
  theme,
  closeButton,
  placement,
  ...args
}) => {
  return (
    <Toggletip
      title={<h2>Toggletip with scrollable content and no interactive controls</h2>}
      content={
        <ScrollContainer maxHeight="500px">
          {/* one of the few documented cases we can turn this rule off */}
          {/* https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-noninteractive-tabindex.md#case-shouldnt-i-add-a-tabindex-so-that-users-can-navigate-to-this-item */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div tabIndex={0}>
            <p>
              If for any reason you have to use a Toggletip with a lot of content with no interactive controls, set a{' '}
              <code>tabIndex=0</code> attribute to the container so keyboard users are able to focus the content and
              able to scroll up and down it.
            </p>
            {new Array(15).fill(undefined).map((_, i) => (
              <p key={i}>This is some content repeated over and over again to ensure it is scrollable.</p>
            ))}
          </div>
        </ScrollContainer>
      }
      footer={footer}
      theme={theme}
      placement={placement}
      {...args}
    >
      <Button>Click to show Toggletip with long content!</Button>
    </Toggletip>
  );
};
LongContent.args = {
  placement: 'auto',
  theme: 'info',
};

LongContent.parameters = {
  controls: {
    hideNoControlsWarning: true,
    exclude: ['title', 'content', 'children'],
  },
};

export const InsideDrawer: StoryFn<typeof Toggletip> = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsDrawerOpen(true)}>Open Drawer</Button>
      {isDrawerOpen && (
        <Drawer title="Drawer with Toggletip" onClose={() => setIsDrawerOpen(false)}>
          <div>
            <p style={{ marginBottom: '16px' }}>This demonstrates using Toggletip inside a Drawer.</p>
            <Toggletip
              title="Interactive Form"
              content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Field label="Name">
                    <Input placeholder="Enter your name" />
                  </Field>
                  <Button variant="primary" size="sm">
                    Submit
                  </Button>
                </div>
              }
              footer="Focus should work correctly within this Toggletip"
              placement="bottom-start"
            >
              <Button>Click to show Toggletip</Button>
            </Toggletip>
          </div>
        </Drawer>
      )}
    </>
  );
};

InsideDrawer.parameters = {
  controls: {
    hideNoControlsWarning: true,
    exclude: ['title', 'content', 'footer', 'children', 'placement', 'theme', 'closeButton', 'portalRoot'],
  },
};

export const InsideModal: StoryFn<typeof Toggletip> = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
      <Modal title="Modal with Toggletip" isOpen={isModalOpen} onDismiss={() => setIsModalOpen(false)}>
        <div>
          <p style={{ marginBottom: '16px' }}>This demonstrates using Toggletip inside a Modal.</p>
          <Modal.ButtonRow>
            <Toggletip
              title="Interactive Form"
              content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Field label="Name">
                    <Input placeholder="Enter your name" />
                  </Field>
                  <Button variant="primary" size="sm">
                    Submit
                  </Button>
                </div>
              }
              footer="Focus should work correctly within this Toggletip"
              placement="bottom-start"
            >
              <Button>Click to show Toggletip</Button>
            </Toggletip>
          </Modal.ButtonRow>
        </div>
      </Modal>
    </>
  );
};

InsideDrawer.parameters = {
  controls: {
    hideNoControlsWarning: true,
    exclude: ['title', 'content', 'footer', 'children', 'placement', 'theme', 'closeButton', 'portalRoot'],
  },
};

export default meta;
