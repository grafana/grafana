import React from 'react';
import { Drawer } from './Drawer';
import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'UI/Drawer',
  component: Drawer,
  decorators: [withCenteredStory],
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
