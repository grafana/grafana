import { Meta } from '@storybook/react';

import { FormattedValueDisplay } from './FormattedValueDisplay';
import mdx from './FormattedValueDisplay.mdx';

const meta: Meta<typeof FormattedValueDisplay> = {
  title: 'Plugins/FormattedValueDisplay',
  component: FormattedValueDisplay,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return <FormattedValueDisplay value={{ text: 'Test value' }} style={{ fontSize: 12 }} />;
};

export default meta;
