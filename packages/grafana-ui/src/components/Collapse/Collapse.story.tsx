import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Collapse, ControlledCollapse } from './Collapse';
import mdx from './Collapse.mdx';

const meta: ComponentMeta<typeof Collapse> = {
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

export default meta;
