import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { SelectableValue } from '@grafana/data';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Button } from '../Button';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { Drawer } from '../Drawer/Drawer';
import { ButtonSelect } from '../Dropdown/ButtonSelect';
import { InlineField } from '../Forms/InlineField';
import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';
import { Modal } from '../Modal/Modal';
import { Select } from '../Select/Select';
import mdx from '../Toggletip/Toggletip.mdx';

import { Toggletip, ToggletipProps } from './Toggletip';
import { ToggletipContentProps } from './types';

const meta: Meta<typeof Toggletip> = {
  title: 'Temporary Toggletip story',
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

const NoiseGenerator = ({ wordsPerPara, paragraphs }: { wordsPerPara: number; paragraphs: number }) => {
  const words = [
    'noise',
    'generator',
    'is',
    'a',
    'function',
    'that',
    'generates',
    'noise',
    'of',
    'a',
    'given',
    'length',
  ];

  const generatePara = () => {
    return new Array(wordsPerPara)
      .fill(undefined)
      .map(() => {
        const randomIndex = Math.floor(Math.random() * words.length);
        return words[randomIndex];
      })
      .join(' ');
  };

  return (
    <>
      {new Array(paragraphs).fill(undefined).map((_, i) => (
        <p key={i}>{generatePara()}</p>
      ))}
    </>
  );
};

const BasicToggleTip = (props: ToggletipProps) => {
  return (
    <Toggletip {...props}>
      <Button>Basic Toggletip</Button>
    </Toggletip>
  );
};

export const DraweredModalToggletip: StoryFn<typeof Toggletip> = (props) => {
  const [openDrawer, setOpenDrawer] = React.useState(false);
  const [openModal, setOpenModal] = React.useState(false);

  return (
    <div>
      <BasicToggleTip {...props} />
      <MultiToggleTip />
      <Button onClick={() => setOpenDrawer(true)}>Open Drawer</Button>
      {openDrawer && (
        <Drawer
          title={<Button onClick={() => setOpenModal(true)}>Open Modal</Button>}
          onClose={() => setOpenDrawer(false)}
          size="sm"
        >
          <CustomScrollbar>
            <NoiseGenerator wordsPerPara={100} paragraphs={3} />
            <BasicToggleTip {...props} />
            <MultiToggleTip />
            <NoiseGenerator wordsPerPara={100} paragraphs={10} />
          </CustomScrollbar>

          <Modal title="Toggletips Modal" isOpen={openModal} onDismiss={() => setOpenModal(false)}>
            <NoiseGenerator wordsPerPara={100} paragraphs={3} />
            <BasicToggleTip {...props} />
            <MultiToggleTip />
            <NoiseGenerator wordsPerPara={100} paragraphs={10} />
          </Modal>
        </Drawer>
      )}
    </div>
  );
};
DraweredModalToggletip.args = {
  title: 'Title of the Toggletip',
  content: 'This is the content of the Toggletip',
  footer: 'Footer of the Toggletip',
  placement: 'auto',
  closeButton: true,
  theme: 'info',
};

export const MultiToggleTip = (props: ToggletipContentProps) => {
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
    <Toggletip title={header} content={body} footer={footer} theme={`info`} closeButton placement="auto" {...props}>
      <Button type="button">Multi Toggletip</Button>
    </Toggletip>
  );
};

export default meta;
