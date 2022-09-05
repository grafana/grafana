import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { CollapsableSection } from './CollapsableSection';
import mdx from './CollapsableSection.mdx';

const meta: ComponentMeta<typeof CollapsableSection> = {
  title: 'Layout/CollapsableSection',
  component: CollapsableSection,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  return (
    <CollapsableSection label="Collapsable section" isOpen>
      <div>{"Here's some content"}</div>
    </CollapsableSection>
  );
};

export default meta;
