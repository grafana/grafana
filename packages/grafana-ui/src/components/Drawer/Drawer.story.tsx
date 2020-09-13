import React from 'react';
import { text } from '@storybook/addon-knobs';
import { Button, Drawer } from '@grafana/ui';
import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './Drawer.mdx';

export default {
  title: 'Overlays/Drawer',
  component: Drawer,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const global = () => {
  const drawerTitle = text('title', 'Drawer title');

  return (
    <UseState initialState={{ isOpen: false }}>
      {(state, updateValue) => {
        return (
          <>
            <Button onClick={() => updateValue({ isOpen: !state.isOpen })}>Open drawer</Button>
            {state.isOpen && (
              <Drawer
                title={drawerTitle}
                subtitle="This is a subtitle."
                onClose={() => {
                  updateValue({ isOpen: !state.isOpen });
                }}
              >
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
      }}
    </UseState>
  );
};

export const longContent = () => {
  return (
    <UseState initialState={{ isOpen: true }}>
      {(state, updateValue) => {
        return (
          <>
            <Button onClick={() => updateValue({ isOpen: !state.isOpen })}>Open drawer</Button>
            {state.isOpen && (
              <Drawer
                scrollableContent
                expandable
                title="Drawer with long content"
                onClose={() => {
                  updateValue({ isOpen: !state.isOpen });
                }}
              >
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
                  dolore magna aliqua. Iaculis nunc sed augue lacus viverra vitae. Malesuada pellentesque elit eget
                  gravida cum sociis. Pretium vulputate sapien nec sagittis aliquam malesuada bibendum arcu. Cras
                  adipiscing enim eu turpis egestas. Ut lectus arcu bibendum at varius. Nulla pellentesque dignissim
                  enim sit amet venenatis urna. Tempus urna et pharetra pharetra massa massa ultricies mi quis. Vitae
                  congue mauris rhoncus aenean. Enim ut tellus elementum sagittis vitae et.
                </p>
                <p>
                  Arcu non odio euismod lacinia at quis risus sed vulputate. Sit amet consectetur adipiscing elit ut.
                  Dictum fusce ut placerat orci nulla pellentesque dignissim. Lectus nulla at volutpat diam ut venenatis
                  tellus. Sed cras ornare arcu dui. Eget mauris pharetra et ultrices neque ornare aenean euismod. Mi
                  quis hendrerit dolor magna. Commodo viverra maecenas accumsan lacus vel facilisis. Eget mi proin sed
                  libero enim sed. Magna ac placerat vestibulum lectus mauris ultrices eros in. Mattis nunc sed blandit
                  libero volutpat.
                </p>
                <p>
                  Cursus in hac habitasse platea dictumst quisque sagittis purus. Viverra adipiscing at in tellus.
                  Semper eget duis at tellus at urna condimentum. Egestas fringilla phasellus faucibus scelerisque
                  eleifend. Sem nulla pharetra diam sit amet nisl. Ut ornare lectus sit amet est placerat in egestas
                  erat. Id neque aliquam vestibulum morbi blandit cursus risus. In iaculis nunc sed augue. Eu volutpat
                  odio facilisis mauris sit. Quisque egestas diam in arcu cursus euismod. At quis risus sed vulputate
                  odio ut enim blandit volutpat. Cursus risus at ultrices mi tempus imperdiet nulla malesuada. Sed
                  adipiscing diam donec adipiscing tristique risus nec. Id neque aliquam vestibulum morbi. Pretium nibh
                  ipsum consequat nisl vel pretium lectus quam. Platea dictumst quisque sagittis purus sit. Nascetur
                  ridiculus mus mauris vitae ultricies leo.
                </p>
                <p>
                  Cursus in hac habitasse platea dictumst quisque sagittis purus. Viverra adipiscing at in tellus.
                  Semper eget duis at tellus at urna condimentum. Egestas fringilla phasellus faucibus scelerisque
                  eleifend. Sem nulla pharetra diam sit amet nisl. Ut ornare lectus sit amet est placerat in egestas
                  erat. Id neque aliquam vestibulum morbi blandit cursus risus. In iaculis nunc sed augue. Eu volutpat
                  odio facilisis mauris sit. Quisque egestas diam in arcu cursus euismod. At quis risus sed vulputate
                  odio ut enim blandit volutpat. Cursus risus at ultrices mi tempus imperdiet nulla malesuada. Sed
                  adipiscing diam donec adipiscing tristique risus nec. Id neque aliquam vestibulum morbi. Pretium nibh
                  ipsum consequat nisl vel pretium lectus quam. Platea dictumst quisque sagittis purus sit. Nascetur
                  ridiculus mus mauris vitae ultricies leo.
                </p>
                <p>
                  Cursus in hac habitasse platea dictumst quisque sagittis purus. Viverra adipiscing at in tellus.
                  Semper eget duis at tellus at urna condimentum. Egestas fringilla phasellus faucibus scelerisque
                  eleifend. Sem nulla pharetra diam sit amet nisl. Ut ornare lectus sit amet est placerat in egestas
                  erat. Id neque aliquam vestibulum morbi blandit cursus risus. In iaculis nunc sed augue. Eu volutpat
                  odio facilisis mauris sit. Quisque egestas diam in arcu cursus euismod. At quis risus sed vulputate
                  odio ut enim blandit volutpat. Cursus risus at ultrices mi tempus imperdiet nulla malesuada. Sed
                  adipiscing diam donec adipiscing tristique risus nec. Id neque aliquam vestibulum morbi. Pretium nibh
                  ipsum consequat nisl vel pretium lectus quam. Platea dictumst quisque sagittis purus sit. Nascetur
                  ridiculus mus mauris vitae ultricies leo.
                </p>
                <p>
                  Cursus in hac habitasse platea dictumst quisque sagittis purus. Viverra adipiscing at in tellus.
                  Semper eget duis at tellus at urna condimentum. Egestas fringilla phasellus faucibus scelerisque
                  eleifend. Sem nulla pharetra diam sit amet nisl. Ut ornare lectus sit amet est placerat in egestas
                  erat. Id neque aliquam vestibulum morbi blandit cursus risus. In iaculis nunc sed augue. Eu volutpat
                  odio facilisis mauris sit. Quisque egestas diam in arcu cursus euismod. At quis risus sed vulputate
                  odio ut enim blandit volutpat. Cursus risus at ultrices mi tempus imperdiet nulla malesuada. Sed
                  adipiscing diam donec adipiscing tristique risus nec. Id neque aliquam vestibulum morbi. Pretium nibh
                  ipsum consequat nisl vel pretium lectus quam. Platea dictumst quisque sagittis purus sit. Nascetur
                  ridiculus mus mauris vitae ultricies leo.
                </p>
                <p>
                  Cursus in hac habitasse platea dictumst quisque sagittis purus. Viverra adipiscing at in tellus.
                  Semper eget duis at tellus at urna condimentum. Egestas fringilla phasellus faucibus scelerisque
                  eleifend. Sem nulla pharetra diam sit amet nisl. Ut ornare lectus sit amet est placerat in egestas
                  erat. Id neque aliquam vestibulum morbi blandit cursus risus. In iaculis nunc sed augue. Eu volutpat
                  odio facilisis mauris sit. Quisque egestas diam in arcu cursus euismod. At quis risus sed vulputate
                  odio ut enim blandit volutpat. Cursus risus at ultrices mi tempus imperdiet nulla malesuada. Sed
                  adipiscing diam donec adipiscing tristique risus nec. Id neque aliquam vestibulum morbi. Pretium nibh
                  ipsum consequat nisl vel pretium lectus quam. Platea dictumst quisque sagittis purus sit. Nascetur
                  ridiculus mus mauris vitae ultricies leo.
                </p>
              </Drawer>
            )}
          </>
        );
      }}
    </UseState>
  );
};

export const inLine = () => {
  const drawerTitle = text('title', 'Storybook');

  return (
    <UseState initialState={{ isOpen: false }}>
      {(state, updateValue) => {
        return (
          <>
            <div
              style={{
                height: '300px',
                width: '500px',
                border: '1px solid white',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Button onClick={() => updateValue({ isOpen: !state.isOpen })}>Open drawer</Button>
              {state.isOpen && (
                <Drawer
                  inline={true}
                  title={drawerTitle}
                  onClose={() => {
                    updateValue({ isOpen: !state.isOpen });
                  }}
                >
                  <ul>
                    <li>this</li>
                    <li>is</li>
                    <li>a</li>
                    <li>list</li>
                    <li>of</li>
                    <li>menu</li>
                    <li>items</li>
                  </ul>
                </Drawer>
              )}
            </div>
          </>
        );
      }}
    </UseState>
  );
};
