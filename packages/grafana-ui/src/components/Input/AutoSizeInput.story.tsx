import { StoryFn, Meta } from '@storybook/react';

import { iconOptions } from '../../utils/storybook/icons';
import { Button } from '../Button/Button';

import { AutoSizeInput } from './AutoSizeInput';
import mdx from './AutoSizeInput.mdx';
import { parseAccessory } from './storyUtils';

const icons: { [key: string]: string | undefined } = { ...iconOptions };
Object.keys(icons).forEach((key) => {
  icons[`icon-${key}`] = icons[key];
});

const prefixSuffixOpts = {
  $: 'Text',
  ...icons,
};

const meta: Meta = {
  title: 'Forms/Input/AutoSizeInput',
  component: AutoSizeInput,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['prefix', 'suffix', 'addonBefore', 'addonAfter'],
    },
  },
  args: {
    type: 'text',
    width: 40,
    prefixVisible: '',
    suffixVisible: '',
    invalid: false,
    loading: false,
    value: '',
    defaultValue: '',
  },
  argTypes: {
    prefixVisible: {
      control: {
        type: 'select',
        labels: prefixSuffixOpts,
      },
      options: Object.keys(prefixSuffixOpts),
    },
    suffixVisible: {
      control: {
        type: 'select',
        labels: prefixSuffixOpts,
      },
      options: Object.keys(prefixSuffixOpts),
    },
    type: {
      control: {
        type: 'select',
      },
      options: ['text', 'number', 'password'],
    },
    minWidth: { control: { type: 'range', min: 10, max: 200, step: 10 } },
  },
};

export const Simple: StoryFn = (args) => {
  const addonAfter = <Button variant="secondary">Load</Button>;
  const addonBefore = <div style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>AutoSizeInput</div>;
  const prefix = parseAccessory(args.prefixVisible);
  const suffix = parseAccessory(args.suffixVisible);

  return (
    <AutoSizeInput
      disabled={args.disabled}
      prefix={prefix}
      invalid={args.invalid}
      width={args.width}
      suffix={suffix}
      loading={args.loading}
      addonBefore={args.before && addonBefore}
      addonAfter={args.after && addonAfter}
      type={args.type}
      placeholder={args.placeholder}
      minWidth={args.minWidth}
      value={args.value}
      defaultValue={args.defaultValue}
    />
  );
};
Simple.args = {
  disabled: false,
  before: false,
  after: false,
  placeholder: 'Enter your name here...',
  value: '',
  defaultValue: '',
};

export default meta;
