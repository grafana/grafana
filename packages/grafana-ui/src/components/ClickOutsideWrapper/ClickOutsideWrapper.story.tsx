import { action } from '@storybook/addon-actions';
import { Meta } from '@storybook/react';

import { ClickOutsideWrapper } from './ClickOutsideWrapper';
import mdx from './ClickOutsideWrapper.mdx';

const meta: Meta<typeof ClickOutsideWrapper> = {
  title: 'Utilities/ClickOutsideWrapper',
  component: ClickOutsideWrapper,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return (
    <ClickOutsideWrapper
      onClick={() => {
        action('Clicked outside!')();
        window.alert('Clicked outside!');
      }}
    >
      <div style={{ width: '300px', border: '1px solid grey', padding: '20px' }}>Click outside this box!</div>
    </ClickOutsideWrapper>
  );
};

export default meta;
