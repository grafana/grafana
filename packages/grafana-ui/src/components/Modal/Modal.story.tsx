import { css, cx } from '@emotion/css';
import { type StoryFn, type Meta } from '@storybook/react-webpack5';
import { oneLineTrim } from 'common-tags';
import { useCallback, useState } from 'react';
import { useArgs } from 'storybook/preview-api';

import { Button } from '../Button/Button';
import { TabContent } from '../Tabs/TabContent';

import { Modal } from './Modal';
import mdx from './Modal.mdx';
import { ModalTabsHeader } from './ModalTabsHeader';

const meta: Meta = {
  title: 'Overlays/Modal',
  component: Modal,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className', 'contentClassName', 'onDismiss', 'onClickBackdrop'],
    },
  },
  args: {
    body: oneLineTrim(`Id incididunt do pariatur qui labore. Sint culpa irure cillum et ullamco proident. Deserunt ipsum velit dolore est enim proident dolore consectetur. Et cillum tempor pariatur et. Est tempor cillum ad id nulla. Cillum ut proident
    magna do cillum consequat reprehenderit excepteur. Pariatur culpa id excepteur reprehenderit consequat qui qui sit
    consectetur esse enim mollit incididunt. Ea excepteur nisi mollit reprehenderit eiusmod tempor. Eiusmod incididunt
    occaecat velit consectetur dolor cillum anim commodo fugiat cupidatat ut tempor officia. Aliquip fugiat occaecat
    excepteur consectetur ullamco consectetur exercitation occaecat sint sint incididunt cillum minim. Sint aliquip ea
    pariatur anim. Veniam laboris mollit in voluptate exercitation sint deserunt dolor ullamco ex dolor. Enim
    reprehenderit ut Lorem aliquip est laborum in. Aliqua in ut aute elit nulla amet. Ex proident pariatur ex in
    aliquip. Labore eu Lorem sint aliqua reprehenderit ipsum veniam aliquip laborum dolor deserunt cupidatat velit
    amet.`),
  },
  argTypes: {
    title: {
      control: {
        type: 'text',
      },
    },
  },
};

export const Basic: StoryFn = ({ body, title, ...args }) => {
  const [, updateArgs] = useArgs();

  const setIsOpen = useCallback(
    (isOpen: boolean) => {
      updateArgs({ isOpen });
    },
    [updateArgs]
  );

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open modal</Button>

      <Modal title={title} {...args} onDismiss={() => setIsOpen(false)}>
        {body}
        <Modal.ButtonRow>
          <Button variant="secondary" fill="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button>Button1</Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
};
Basic.args = {
  title: 'My Modal',
  isOpen: true,
  closeOnEscape: true,
};

const tabs = [
  { label: '1st child', value: 'first', active: true },
  { label: '2nd child', value: 'second', active: false },
  { label: '3rd child', value: 'third', active: false },
];

export const WithTabs: StoryFn = (args) => {
  const [, updateArgs] = useArgs();
  const [activeTab, setActiveTab] = useState('first');

  const setIsOpen = useCallback((isOpen: boolean) => updateArgs({ isOpen }), [updateArgs]);

  const modalHeader = (
    <ModalTabsHeader
      title={args.title}
      tabs={tabs}
      activeTab={activeTab}
      onChangeTab={(t) => {
        setActiveTab(t.value);
      }}
    />
  );
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open modal</Button>
      <Modal ariaLabel={args.title} title={modalHeader} {...args} onDismiss={() => setIsOpen(false)}>
        <TabContent>
          {activeTab === tabs[0].value && <div>{args.body}</div>}
          {activeTab === tabs[1].value && <div>Second tab content</div>}
          {activeTab === tabs[2].value && <div>Third tab content</div>}
        </TabContent>
      </Modal>
    </>
  );
};
WithTabs.args = {
  title: 'My Modal',
  icon: 'cog',
  isOpen: true,
};

export const UsingContentClassName: StoryFn = ({ title, body, ...args }) => {
  const [, updateArgs] = useArgs();

  const setIsOpen = useCallback((isOpen: boolean) => updateArgs({ isOpen }), [updateArgs]);

  const override = {
    modalContent: css({
      backgroundColor: 'red',
      color: 'black',
    }),
  };
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open modal</Button>
      <Modal title={title} {...args} contentClassName={cx(override.modalContent)} onDismiss={() => setIsOpen(false)}>
        {body}
      </Modal>
    </>
  );
};
UsingContentClassName.args = {
  title: 'Using contentClassName to override background',
  isOpen: true,
  closeOnEscape: false,
};

export default meta;
