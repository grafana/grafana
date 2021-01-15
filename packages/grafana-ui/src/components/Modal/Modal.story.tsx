import React, { useState } from 'react';
import { oneLineTrim } from 'common-tags';
import { text, boolean } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { Modal, Icon, TabContent, ModalTabsHeader } from '@grafana/ui';
import mdx from './Modal.mdx';

const getKnobs = () => {
  return {
    body: text(
      'Body',
      oneLineTrim`Id incididunt do pariatur qui labore. Sint culpa irure cillum et ullamco proident. Deserunt ipsum velit dolore est enim proident dolore consectetur. Et cillum tempor pariatur et. Est tempor cillum ad id nulla. Cillum ut proident
magna do cillum consequat reprehenderit excepteur. Pariatur culpa id excepteur reprehenderit consequat qui qui sit
consectetur esse enim mollit incididunt. Ea excepteur nisi mollit reprehenderit eiusmod tempor. Eiusmod incididunt
occaecat velit consectetur dolor cillum anim commodo fugiat cupidatat ut tempor officia. Aliquip fugiat occaecat
excepteur consectetur ullamco consectetur exercitation occaecat sint sint incididunt cillum minim. Sint aliquip ea
pariatur anim. Veniam laboris mollit in voluptate exercitation sint deserunt dolor ullamco ex dolor. Enim
reprehenderit ut Lorem aliquip est laborum in. Aliqua in ut aute elit nulla amet. Ex proident pariatur ex in
aliquip. Labore eu Lorem sint aliqua reprehenderit ipsum veniam aliquip laborum dolor deserunt cupidatat velit
amet.`
    ),
    visible: boolean('Visible', true),
  };
};

export default {
  title: 'Overlays/Modal',
  component: Modal,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  const { body, visible } = getKnobs();
  return (
    <Modal
      title={
        <div className="modal-header-title">
          <Icon name="exclamation-triangle" size="lg" />
          <span className="p-l-1">My Modal</span>
        </div>
      }
      isOpen={visible}
    >
      {body}
    </Modal>
  );
};

const tabs = [
  { label: '1st child', value: 'first', active: true },
  { label: '2nd child', value: 'second', active: false },
  { label: '3rd child', value: 'third', active: false },
];

export const WithTabs = () => {
  const [activeTab, setActiveTab] = useState('first');
  const modalHeader = (
    <ModalTabsHeader
      title="Modal With Tabs"
      icon="cog"
      tabs={tabs}
      activeTab={activeTab}
      onChangeTab={t => {
        setActiveTab(t.value);
      }}
    />
  );
  return (
    <UseState initialState={tabs}>
      {(state, updateState) => {
        return (
          <div>
            <Modal title={modalHeader} isOpen={true}>
              <TabContent>
                {activeTab === state[0].value && <div>First tab content</div>}
                {activeTab === state[1].value && <div>Second tab content</div>}
                {activeTab === state[2].value && <div>Third tab content</div>}
              </TabContent>
            </Modal>
          </div>
        );
      }}
    </UseState>
  );
};
