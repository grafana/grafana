import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { SelectableValue } from '@grafana/data';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Button } from '../Button';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { ButtonSelect } from '../Dropdown/ButtonSelect';
import { InlineField } from '../Forms/InlineField';
import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';
import mdx from '../Toggletip/Toggletip.mdx';

import { Toggletip } from './Toggletip';

const meta: Meta<typeof Toggletip> = {
  title: 'Overlays/Toggletip',
  component: Toggletip,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onClose', 'children'],
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

export const HostingMultiElements: StoryFn<typeof Toggletip> = ({ theme, closeButton, placement }) => {
  const selectOptions: Array<SelectableValue<number>> = [
    { label: 'Sharilyn Markowitz', value: 1 },
    { label: 'Naomi Striplin', value: 2 },
    { label: 'Beau Bevel', value: 3 },
    { label: 'Garrett Starkes', value: 4 },
  ];
  const dropdownOptions: Array<SelectableValue<string>> = [
    { label: 'Option A', value: 'a' },
    { label: 'Option B', value: 'b' },
    { label: 'Option C', value: 'c' },
  ];
  const header = (
    <div>
      <Icon name="apps" />
      &nbsp;<strong>Header title with icon</strong>
    </div>
  );
  const body = (
    <div>
      <InlineField label="Users" labelWidth={15}>
        <Select width={20} options={selectOptions} value={2} onChange={() => {}} />
      </InlineField>
      <InlineField label="Job Title" labelWidth={15}>
        <Input value={'Professor'} width={20} />
      </InlineField>
      <InlineField label="My Button Select" labelWidth={15}>
        <ButtonSelect
          options={dropdownOptions}
          value={dropdownOptions[2]}
          variant={'primary'}
          onChange={() => {}}
          style={{ width: '160px' }}
        ></ButtonSelect>
      </InlineField>
      <div>
        <br />
        <span>Wants to know more?</span>&nbsp;
        <a href="https://grafana.com/" target="_blank" rel="noreferrer">
          <Icon name="link" />
          &nbsp;Click here!
        </a>
      </div>
    </div>
  );
  const footer = (
    <div>
      <Button type="button" variant="success" onClick={() => alert('Click on Save!')}>
        Save on footer
      </Button>
      &nbsp;
      <Button type="button" variant="destructive" onClick={() => alert('Click on Delete!')}>
        Delete
      </Button>
    </div>
  );

  return (
    <Toggletip
      title={header}
      content={body}
      footer={footer}
      theme={theme}
      closeButton={closeButton}
      placement={placement}
    >
      <Button type="button">Click to show Toggletip hosting multiple components!</Button>
    </Toggletip>
  );
};

HostingMultiElements.parameters = {
  controls: {
    hideNoControlsWarning: true,
    exclude: ['title', 'content', 'footer', 'onClose', 'children'],
  },
};
HostingMultiElements.args = {
  placement: 'top',
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
        <CustomScrollbar autoHeightMax="500px">
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
        </CustomScrollbar>
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

export default meta;
