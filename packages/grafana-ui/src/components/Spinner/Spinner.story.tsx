import { Meta, StoryFn } from '@storybook/react';

import { Props, Spinner } from './Spinner';
import mdx from './Spinner.mdx';

const meta: Meta = {
  title: 'Visualizations/Spinner',
  component: Spinner,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className', 'iconClassName', 'style', 'inline'],
    },
  },
  argTypes: {
    backgroundColor: { control: { type: 'color' } },
    color: { control: { type: 'color' } },
  },
};

interface StoryProps extends Partial<Props> {
  backgroundColor: string;
  color: string;
  withStyle: boolean;
}

export const Basic: StoryFn<StoryProps> = (args) => {
  return (
    <div>
      <Spinner
        style={
          args.withStyle === true
            ? {
                backgroundColor: `${args.backgroundColor}`,
                color: `${args.color}`,
              }
            : {}
        }
        size={args.size}
      />
    </div>
  );
};
Basic.args = {
  backgroundColor: 'white',
  color: 'red',
  size: 'xl',
  withStyle: false,
};

export default meta;
