import React from 'react';
import { Collapse, ControlledCollapse } from './Collapse';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import mdx from './Collapse.mdx';

export default {
  title: 'Layout/Collapse',
  component: Collapse,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return (
    <UseState initialState={{ isOpen: false }}>
      {(state, updateValue) => {
        return (
          <Collapse
            collapsible
            label="Collapse panel"
            isOpen={state.isOpen}
            onToggle={() => updateValue({ isOpen: !state.isOpen })}
          >
            <p>Panel data</p>
          </Collapse>
        );
      }}
    </UseState>
  );
};

export const controlled = () => {
  return (
    <ControlledCollapse label="Collapse panel">
      <p>Panel data</p>
    </ControlledCollapse>
  );
};
