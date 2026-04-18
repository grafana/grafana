import type { Meta } from '@storybook/react';

import { getDefaultWrapper } from './provider';

const Wrapper = getDefaultWrapper();

export const defaultDecorators: Meta['decorators'] = [
  (Story) => (
    <Wrapper>
      <Story />
    </Wrapper>
  ),
];
