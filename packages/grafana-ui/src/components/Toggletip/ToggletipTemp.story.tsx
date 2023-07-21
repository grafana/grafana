import { Meta, StoryFn } from '@storybook/react';
import React, { ReactElement } from 'react';

import { SelectableValue } from '@grafana/data';
import { InteractiveTable, Column } from '@grafana/ui';

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

const MultiToggleTip = ({ placement = 'auto' }: { placement?: ToggletipProps['placement'] }) => {
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
    <Toggletip title={header} content={body} footer={footer} theme={`info`} closeButton placement={placement}>
      <Button type="button">Multi Toggletip</Button>
    </Toggletip>
  );
};

// works with keyboard, issues with Mouse and click handlers
export const KitchenSinkToggletip: StoryFn<typeof Toggletip> = (props) => {
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

export const ModalToggletip: StoryFn<typeof Toggletip> = (props) => {
  const [openModal, setOpenModal] = React.useState(false);

  return (
    <div>
      <Button onClick={() => setOpenModal(true)}>Open Modal</Button>
      <Modal title="Toggletips Modal" isOpen={openModal} onDismiss={() => setOpenModal(false)}>
        <NoiseGenerator wordsPerPara={100} paragraphs={3} />
        <div style={{ display: `flex`, justifyContent: `space-between` }}>
          <BasicToggleTip {...props} placement="left" />
          <MultiToggleTip placement="right" />
        </div>
        <NoiseGenerator wordsPerPara={100} paragraphs={10} />
      </Modal>
    </div>
  );
};

const baseArgs = {
  title: 'Title of the Toggletip',
  content: 'This is the content of the Toggletip',
  footer: 'Footer of the Toggletip',
  placement: 'auto',
  closeButton: true,
  theme: 'info',
} as const;

KitchenSinkToggletip.args = {
  ...baseArgs,
};

ModalToggletip.args = {
  ...baseArgs,
};

interface Entry {
  id: number;
  firstName: string;
  lastName: string;
  sign: ReactElement;
}

export const UsefulPersistentToggletips: StoryFn<typeof Toggletip> = (props) => {
  const columns: Array<Column<Entry>> = [
    { id: 'firstName', header: 'First name' },
    { id: 'lastName', header: 'Last name' },
    { id: 'sign', header: 'Temperament' },
  ];

  const meanings = [
    { render: [128054], meaning: 'Loyal' },
    { render: [128055], meaning: 'Friendly' },
    { render: [128056], meaning: 'Tiny' },
    { render: [128057], meaning: 'Quiet' },
    { render: [128058], meaning: 'Fast' },
    { render: [128059], meaning: 'Hostile' },
    { render: [128055, 128059], meaning: 'Unpredictable' },
    { render: [128056, 128055, 128057], meaning: 'Crazy' },
  ];

  const Emojis = ({ codes }: { codes: number[] }) => {
    return <>{codes.map((n) => String.fromCodePoint(n)).join('')}</>;
  };

  const explainer = (
    <table>
      <tbody>
        {meanings.map(({ render, meaning }) => (
          <tr key={meaning}>
            <td>
              <Emojis codes={render} />
            </td>
            <td>{meaning}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const data: Entry[] = [
    { id: 1, firstName: 'John', lastName: 'Doe', sign: <Emojis codes={meanings[0].render} /> },
    { id: 2, firstName: 'Stuart', lastName: 'Jones', sign: <Emojis codes={meanings[1].render} /> },
    { id: 3, firstName: 'Ralph', lastName: 'Smith', sign: <Emojis codes={meanings[2].render} /> },
    { id: 8, firstName: 'Ivy', lastName: 'Little', sign: <Emojis codes={meanings[7].render} /> },
    { id: 4, firstName: 'Thomas', lastName: 'Tins', sign: <Emojis codes={meanings[3].render} /> },
    { id: 5, firstName: 'Jane', lastName: 'Johnson', sign: <Emojis codes={meanings[4].render} /> },
    { id: 6, firstName: 'Ken', lastName: 'Clutton', sign: <Emojis codes={meanings[5].render} /> },
    { id: 7, firstName: 'Bob', lastName: 'Tucker', sign: <Emojis codes={meanings[0].render} /> },
  ];

  return (
    <div>
      <Toggletip content={explainer} placement="top">
        <Button>Data explainer</Button>
      </Toggletip>
      <InteractiveTable columns={columns} data={data} getRowId={(row) => String(row.id)} />
    </div>
  );
};

UsefulPersistentToggletips.args = {
  title: 'Title of the Toggletip',
  content: 'This is the content of the Toggletip',
  footer: 'Footer of the Toggletip',
  placement: 'auto',
  closeButton: true,
  theme: 'info',
};

export default meta;
