import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';

import { Typography } from './Typography';

export default {
  title: 'General/Typography',
  component: Typography,
  parameters: {
    docs: {},
  },
};

export const Typopgraphy = () => {
  return (
    <VerticalGroup>
      <StoryExample name="Native header elements (global styles)">
        <h1>h1. Heading</h1>
        <h2>h2. Heading</h2>
        <h3>h3. Heading</h3>
        <h4>h4. Heading</h4>
        <h5>h5. Heading</h5>
        <h6>h6. Heading</h6>
      </StoryExample>
    </VerticalGroup>
  );
};
