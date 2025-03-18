import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';

import { CollapsableSection, Props } from './CollapsableSection';
import mdx from './CollapsableSection.mdx';

const meta: Meta<typeof CollapsableSection> = {
  title: 'Layout/CollapsableSection',
  component: CollapsableSection,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className', 'contentClassName', 'onToggle', 'labelId', 'isOpen'],
    },
  },
  args: {
    isOpen: false,
    loading: false,
    label: 'Collapsable section title',
    children: 'Collapsed content data',
  },
  argTypes: {
    label: { control: 'text' },
  },
};

export const Basic: StoryFn<typeof CollapsableSection> = ({ children, ...args }: Props) => {
  const [, updateArgs] = useArgs();

  const onToggle = (isOpen: boolean) => {
    action('onToggle fired')({ isOpen });
    updateArgs({ isOpen });
  };

  return (
    <div>
      <CollapsableSection {...args} onToggle={onToggle}>
        <>{children}</>
      </CollapsableSection>
    </div>
  );
};

export default meta;
