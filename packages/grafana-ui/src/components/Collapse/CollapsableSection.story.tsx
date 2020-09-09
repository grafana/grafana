import React from 'react';
import { CollapsableSection } from './CollapsableSection';
import mdx from './CollapsableSection.mdx';

export default {
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
      <div>Here's some content</div>
    </CollapsableSection>
  );
};
