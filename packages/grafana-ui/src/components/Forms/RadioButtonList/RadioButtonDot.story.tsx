import { Meta, Story } from '@storybook/react';
import React from 'react';

import { RadioButtonDot } from './RadioButtonDot';

export default {
  title: 'Forms/RadioButtonDot',
  component: RadioButtonDot,
} as Meta;

const Wrapper: React.FC<{ title: string }> = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <h5>{title}</h5>
    {children}
  </div>
);

export const RadioButtonDots: Story = (args) => {
  return (
    <div>
      <Wrapper title="Default">
        <RadioButtonDot id="1" name="default-empty" label="Radio label" />
      </Wrapper>

      <Wrapper title="Checked">
        <RadioButtonDot id="2" name="default-checked" label="Radio label" checked />
      </Wrapper>

      <Wrapper title="Disabled default">
        <RadioButtonDot id="3" name="disabled-default-empty" label="Radio label" disabled />
      </Wrapper>

      <Wrapper title="Disabled checked">
        <RadioButtonDot id="4" name="disabled-default-checked" label="Radio label" checked disabled />
      </Wrapper>

      <Wrapper title="Group">
        <RadioButtonDot id="10" name="group" label="One" />
        <RadioButtonDot id="11" name="group" label="Two" />
        <RadioButtonDot id="12" name="group" label="Three" />
      </Wrapper>

      <Wrapper title="Group with long labels">
        <RadioButtonDot
          id="10"
          name="group"
          label="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua"
        />
        <RadioButtonDot
          id="11"
          name="group"
          label="Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
        />
        <RadioButtonDot
          id="12"
          name="group"
          label="Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
        />
      </Wrapper>
    </div>
  );
};
