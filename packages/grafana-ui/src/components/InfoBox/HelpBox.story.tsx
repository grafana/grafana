import React from 'react';
import { Story } from '@storybook/react';
import { HelpBox } from './HelpBox';
import { action } from '@storybook/addon-actions';

export default {
  title: 'Layout/HelpBox',
  component: HelpBox,
  decorators: [],
  parameters: {
    docs: {},
    knobs: { disable: true },
    controls: {
      exclude: ['onClose'],
    },
  },
  argTypes: {},
};

export const Example: Story = (args) => {
  const markdown = `

With this transform you can for example transform 

Name    | Value | Max 
--------|-------|------
ServerA | 10    | 100
ServerB | 20    | 200
ServerC | 30    | 300

Into

ServerA (max=100) | ServerB (max=200) | ServerC (max=300) 
------------------|------------------ | ------------------
10                | 20                | 30         

## More examples

ServerA (max=100) | ServerB (max=200)
------------------|------------------
10                | 20   

[Read more here](https://grafana.com)
`;

  return <HelpBox heading="Transformation help" markdown={markdown} onRemove={action('Remove')}></HelpBox>;
};
