import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { Button } from '../Button/Button';
import { Tab } from '../Tabs/Tab';
import { TabsBar } from '../Tabs/TabsBar';

import { Drawer } from './Drawer';
import mdx from './Drawer.mdx';

const meta: Meta<typeof Drawer> = {
  title: 'Overlays/Drawer',
  component: Drawer,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onClose', 'tabs'],
    },
  },
  args: {
    closeOnMaskClick: true,
    expandable: false,
    subtitle: 'This is a subtitle.',
  },
  argTypes: {
    title: { control: { type: 'text' } },
    width: { control: { type: 'text' } },
    subtitle: { control: { type: 'text' } },
  },
};

export const Global: StoryFn<typeof Drawer> = (args) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open drawer</Button>
      {isOpen && (
        <Drawer {...args} onClose={() => setIsOpen(false)}>
          <div style={{ padding: '10px' }}>
            <ul>
              <li>this</li>
              <li>is</li>
              <li>a</li>
              <li>list</li>
              <li>of</li>
              <li>menu</li>
              <li>items</li>
            </ul>
          </div>
        </Drawer>
      )}
    </>
  );
};

Global.args = {
  title: 'Drawer title',
};

export const LongContent: StoryFn<typeof Drawer> = (args) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open drawer</Button>
      {isOpen && (
        <Drawer {...args} onClose={() => setIsOpen(false)}>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Iaculis nunc sed augue lacus viverra vitae. Malesuada pellentesque elit eget gravida
            cum sociis. Pretium vulputate sapien nec sagittis aliquam malesuada bibendum arcu. Cras adipiscing enim eu
            turpis egestas. Ut lectus arcu bibendum at varius. Nulla pellentesque dignissim enim sit amet venenatis
            urna. Tempus urna et pharetra pharetra massa massa ultricies mi quis. Vitae congue mauris rhoncus aenean.
            Enim ut tellus elementum sagittis vitae et.
          </p>
          <p>
            Arcu non odio euismod lacinia at quis risus sed vulputate. Sit amet consectetur adipiscing elit ut. Dictum
            fusce ut placerat orci nulla pellentesque dignissim. Lectus nulla at volutpat diam ut venenatis tellus. Sed
            cras ornare arcu dui. Eget mauris pharetra et ultrices neque ornare aenean euismod. Mi quis hendrerit dolor
            magna. Commodo viverra maecenas accumsan lacus vel facilisis. Eget mi proin sed libero enim sed. Magna ac
            placerat vestibulum lectus mauris ultrices eros in. Mattis nunc sed blandit libero volutpat.
          </p>
          <p>
            Cursus in hac habitasse platea dictumst quisque sagittis purus. Viverra adipiscing at in tellus. Semper eget
            duis at tellus at urna condimentum. Egestas fringilla phasellus faucibus scelerisque eleifend. Sem nulla
            pharetra diam sit amet nisl. Ut ornare lectus sit amet est placerat in egestas erat. Id neque aliquam
            vestibulum morbi blandit cursus risus. In iaculis nunc sed augue. Eu volutpat odio facilisis mauris sit.
            Quisque egestas diam in arcu cursus euismod. At quis risus sed vulputate odio ut enim blandit volutpat.
            Cursus risus at ultrices mi tempus imperdiet nulla malesuada. Sed adipiscing diam donec adipiscing tristique
            risus nec. Id neque aliquam vestibulum morbi. Pretium nibh ipsum consequat nisl vel pretium lectus quam.
            Platea dictumst quisque sagittis purus sit. Nascetur ridiculus mus mauris vitae ultricies leo.
          </p>
          <p>
            Cursus in hac habitasse platea dictumst quisque sagittis purus. Viverra adipiscing at in tellus. Semper eget
            duis at tellus at urna condimentum. Egestas fringilla phasellus faucibus scelerisque eleifend. Sem nulla
            pharetra diam sit amet nisl. Ut ornare lectus sit amet est placerat in egestas erat. Id neque aliquam
            vestibulum morbi blandit cursus risus. In iaculis nunc sed augue. Eu volutpat odio facilisis mauris sit.
            Quisque egestas diam in arcu cursus euismod. At quis risus sed vulputate odio ut enim blandit volutpat.
            Cursus risus at ultrices mi tempus imperdiet nulla malesuada. Sed adipiscing diam donec adipiscing tristique
            risus nec. Id neque aliquam vestibulum morbi. Pretium nibh ipsum consequat nisl vel pretium lectus quam.
            Platea dictumst quisque sagittis purus sit. Nascetur ridiculus mus mauris vitae ultricies leo.
          </p>
          <p>
            Cursus in hac habitasse platea dictumst quisque sagittis purus. Viverra adipiscing at in tellus. Semper eget
            duis at tellus at urna condimentum. Egestas fringilla phasellus faucibus scelerisque eleifend. Sem nulla
            pharetra diam sit amet nisl. Ut ornare lectus sit amet est placerat in egestas erat. Id neque aliquam
            vestibulum morbi blandit cursus risus. In iaculis nunc sed augue. Eu volutpat odio facilisis mauris sit.
            Quisque egestas diam in arcu cursus euismod. At quis risus sed vulputate odio ut enim blandit volutpat.
            Cursus risus at ultrices mi tempus imperdiet nulla malesuada. Sed adipiscing diam donec adipiscing tristique
            risus nec. Id neque aliquam vestibulum morbi. Pretium nibh ipsum consequat nisl vel pretium lectus quam.
            Platea dictumst quisque sagittis purus sit. Nascetur ridiculus mus mauris vitae ultricies leo.
          </p>
          <p>
            Cursus in hac habitasse platea dictumst quisque sagittis purus. Viverra adipiscing at in tellus. Semper eget
            duis at tellus at urna condimentum. Egestas fringilla phasellus faucibus scelerisque eleifend. Sem nulla
            pharetra diam sit amet nisl. Ut ornare lectus sit amet est placerat in egestas erat. Id neque aliquam
            vestibulum morbi blandit cursus risus. In iaculis nunc sed augue. Eu volutpat odio facilisis mauris sit.
            Quisque egestas diam in arcu cursus euismod. At quis risus sed vulputate odio ut enim blandit volutpat.
            Cursus risus at ultrices mi tempus imperdiet nulla malesuada. Sed adipiscing diam donec adipiscing tristique
            risus nec. Id neque aliquam vestibulum morbi. Pretium nibh ipsum consequat nisl vel pretium lectus quam.
            Platea dictumst quisque sagittis purus sit. Nascetur ridiculus mus mauris vitae ultricies leo.
          </p>
          <p>
            Cursus in hac habitasse platea dictumst quisque sagittis purus. Viverra adipiscing at in tellus. Semper eget
            duis at tellus at urna condimentum. Egestas fringilla phasellus faucibus scelerisque eleifend. Sem nulla
            pharetra diam sit amet nisl. Ut ornare lectus sit amet est placerat in egestas erat. Id neque aliquam
            vestibulum morbi blandit cursus risus. In iaculis nunc sed augue. Eu volutpat odio facilisis mauris sit.
            Quisque egestas diam in arcu cursus euismod. At quis risus sed vulputate odio ut enim blandit volutpat.
            Cursus risus at ultrices mi tempus imperdiet nulla malesuada. Sed adipiscing diam donec adipiscing tristique
            risus nec. Id neque aliquam vestibulum morbi. Pretium nibh ipsum consequat nisl vel pretium lectus quam.
            Platea dictumst quisque sagittis purus sit. Nascetur ridiculus mus mauris vitae ultricies leo.
          </p>
        </Drawer>
      )}
    </>
  );
};
LongContent.args = {
  title: 'Drawer title with long content',
};

export const WithTabs: StoryFn<typeof Drawer> = (args) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('options');

  const tabs = (
    <TabsBar>
      <Tab
        label="Options"
        active={activeTab === 'options'}
        onChangeTab={(ev) => {
          ev?.preventDefault();
          setActiveTab('options');
        }}
      />
      <Tab
        label="Changes"
        active={activeTab === 'changes'}
        onChangeTab={(ev) => {
          ev?.preventDefault();
          setActiveTab('changes');
        }}
        counter={10}
      />
    </TabsBar>
  );

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open drawer</Button>
      {isOpen && (
        <Drawer {...args} tabs={tabs} onClose={() => setIsOpen(false)}>
          {activeTab === 'options' && <div>Here are some options</div>}
          {activeTab === 'changes' && <div>Here are some changes</div>}
        </Drawer>
      )}
    </>
  );
};

WithTabs.args = {
  title: 'Drawer title with tabs',
};

export default meta;
