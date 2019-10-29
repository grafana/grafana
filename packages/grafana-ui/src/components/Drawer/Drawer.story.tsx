import React from 'react';
import { Drawer } from './Drawer';
import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './Drawer.mdx';

export default {
  title: 'UI/Drawer',
  component: Drawer,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const global = () => {
  return (
    <UseState initialState={{ isOpen: false }}>
      {(state, updateValue) => {
        return (
          <>
            <div
              style={{ border: '1px solid gray', borderRadius: '4px', padding: '10px', cursor: 'pointer' }}
              onClick={() => updateValue({ isOpen: !state.isOpen })}
            >
              Open drawer
            </div>
            {state.isOpen && (
              <Drawer
                title="storybook"
                onClose={() => {
                  updateValue({ isOpen: !state.isOpen });
                }}
              >
                this is a drawer
              </Drawer>
            )}
          </>
        );
      }}
    </UseState>
  );
};

export const inLine = () => {
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
              <div
                style={{ border: '1px solid gray', borderRadius: '4px', padding: '10px', cursor: 'pointer' }}
                onClick={() => updateValue({ isOpen: !state.isOpen })}
              >
                Open drawer
              </div>
              {state.isOpen && (
                <Drawer
                  inline={true}
                  title="storybook"
                  onClose={() => {
                    updateValue({ isOpen: !state.isOpen });
                  }}
                >
                  this is a drawer
                </Drawer>
              )}
            </div>
          </>
        );
      }}
    </UseState>
  );
};
