import { type Meta, type StoryFn, type StoryObj } from '@storybook/react-webpack5';
import { action } from 'storybook/actions';
import { useArgs, useState, useEffect } from 'storybook/preview-api';

import { Button } from '../Button/Button';
import { Field } from '../Forms/Field';

import { Combobox, type ComboboxProps } from './Combobox';
import mdx from './Combobox.mdx';
import { fakeSearchAPI, generateGroupingOptions, generateOptions } from './storyUtils';
import { type ComboboxOption } from './types';

type PropsAndCustomArgs<T extends string | number = string> = ComboboxProps<T> & {
  numberOfOptions: number;
};
type Story<T extends string | number = string> = StoryObj<PropsAndCustomArgs<T>>;

const meta: Meta<PropsAndCustomArgs> = {
  title: 'Inputs/Combobox',
  component: Combobox,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  args: {
    loading: undefined,
    invalid: undefined,
    width: 20,
    isClearable: false,
    placeholder: 'Select an option...',
    options: [
      {
        label: 'Apple',
        value: 'apple',
        description: 'Apples are a great source of fiber and vitamin C.',
      },
      {
        label: 'Banana',
        value: 'banana',
        description:
          'Bananas are a great source of potassium, fiber, and vitamin C. They are also a great snack for on the go.',
      },
      { label: 'Carrot', value: 'carrot' },
      // Long label to test overflow
      {
        label:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        value: 'long-text',
      },
      { label: 'Dill', value: 'dill' },
      { label: 'Eggplant', value: 'eggplant' },
      { label: 'Fennel', value: 'fennel' },
      { label: 'Grape', value: 'grape' },
      { label: 'Honeydew', value: 'honeydew' },
      {
        label: 'Iceberg Lettuce',
        value: 'iceberg-lettuce',
        description:
          'this is a very long description that should be longer than the longest option label which should make the options list as long as the longest description. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      },
      { label: 'Jackfruit', value: 'jackfruit' },
    ],
    value: 'banana',
  },
};
export default meta;

const loadOptionsAction = action('options called');
const onChangeAction = action('onChange called');

const BaseCombobox: StoryFn<PropsAndCustomArgs> = (args) => {
  const [dynamicArgs, setArgs] = useArgs();

  return (
    <Field label="Test input" description="Input with a few options">
      <Combobox
        {...args}
        {...dynamicArgs}
        onChange={(value: ComboboxOption | null) => {
          setArgs({ value: value?.value || null });
          onChangeAction(value);
        }}
      />
    </Field>
  );
};

export const Basic: Story = {
  render: BaseCombobox,
};

export const AutoSize: Story = {
  args: {
    width: 'auto',
    minWidth: 5,
    maxWidth: 200,
  },
  render: BaseCombobox,
};

export const OptionIcons: Story = {
  args: {
    width: 'auto',
    value: 'one',
    options: [
      { label: 'One', value: 'one', group: 'Group 1', icon: 'text-fields' },
      { label: 'Two', value: 'two', group: 'Group 1', icon: 'text-fields' },
      { label: 'Three', value: 'three', group: 'Group 2', icon: 'keyboard' },
      { label: 'Four', value: 'four', group: 'Group 2', icon: 'keyboard' },
    ],
  },
  render: BaseCombobox,
};

export const CustomValue: Story = {
  args: {
    createCustomValue: true,
  },
  render: BaseCombobox,
};

export const DescriptionsOnRight: Story = {
  args: {
    descriptionPosition: 'right',
    placeholder: 'Type to search (city, abbreviation)',
    value: 'default',
    options: [
      { label: 'Default', value: 'default', description: 'CDT -05:00' },
      { label: 'Browser Time', value: 'browser', description: 'CDT -05:00' },
      { label: 'Coordinated Universal Time', value: 'utc', description: 'UTC, GMT +00:00' },
      { label: 'UTC', value: 'zone-utc', description: 'UTC +00:00' },
      { label: 'Abidjan', value: 'africa/abidjan', description: 'GMT +00:00', group: 'Africa' },
      { label: 'Accra', value: 'africa/accra', description: 'GMT +00:00', group: 'Africa' },
      { label: 'Addis Ababa', value: 'africa/addis_ababa', description: 'EAT +03:00', group: 'Africa' },
      { label: 'Algiers', value: 'africa/algiers', description: 'CET +01:00', group: 'Africa' },
      { label: 'Cairo', value: 'africa/cairo', description: 'EEST +03:00', group: 'Africa' },
      { label: 'Adak', value: 'america/adak', description: 'HDT -09:00', group: 'America' },
      { label: 'Anchorage', value: 'america/anchorage', description: 'AKDT -08:00', group: 'America' },
      { label: 'Chicago', value: 'america/chicago', description: 'CDT -05:00', group: 'America' },
      { label: 'New York', value: 'america/new_york', description: 'EDT -04:00', group: 'America' },
    ],
  },
  render: BaseCombobox,
};

const onIsOpenChangeAction = action('onIsOpenChange');

export const ControlledOpenState: Story = {
  name: 'Control isOpen',
  args: {
    value: null,
    placeholder: 'Choose fruit…',
  },

  render: function ControlledOpenStateStory(args: PropsAndCustomArgs) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dynamicArgs, setArgs] = useArgs();

    return (
      <>
        <Field
          label="Controlled dropdown open"
          description="Button triggers combobox open via isOpen and onIsOpenChange. Close with Escape or by selecting."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Combobox
              {...args}
              {...dynamicArgs}
              isOpen={dropdownOpen}
              onIsOpenChange={(open) => {
                onIsOpenChangeAction(open);
                setDropdownOpen(open);
              }}
              onChange={(value: ComboboxOption | null) => {
                setArgs({ value: value?.value ?? null });
                onChangeAction(value);
              }}
            />
          </div>
        </Field>
        <Button variant="primary" onClick={() => setDropdownOpen(true)}>
          Open dropdown
        </Button>
      </>
    );
  },
};

export const GroupsWithMixedLabels: Story = {
  args: {
    options: [
      { label: 'One', value: 'one', group: 'Group 1' },
      { label: 'Two', value: 'two', group: 'Group 1' },
      { label: 'Three', value: 'three', group: 'Group 3' },
      { label: 'Four', value: 'four', group: 'Group 1' },
      { label: 'Five', value: 'five' },
      { label: 'Six', value: 'six' },
      { label: 'Seven', value: 'seven', group: 'Group 2' },
      { label: 'Eight', value: 'eight', group: 'Group 3' },
      { label: 'Nine', value: 'nine', group: 'Group 3' },
      { label: 'Ten', value: 'ten', group: 'Group 3' },
      { label: 'Eleven', value: 'eleven' },
    ],
    value: '',
  },
  render: BaseCombobox,
};

export const Groups: Story = {
  args: {
    options: await generateGroupingOptions(500),
    value: '34',
  },
  render: BaseCombobox,
};

export const ManyOptions: Story = {
  args: {
    numberOfOptions: 1e5,
    options: undefined,
    value: undefined,
  },
  render: function ManyOptions({ numberOfOptions, ...args }: PropsAndCustomArgs) {
    const [dynamicArgs, setArgs] = useArgs();
    const [options, setOptions] = useState<ComboboxOption[]>([]);

    useEffect(() => {
      setTimeout(() => {
        generateOptions(numberOfOptions).then((options) => {
          setOptions(options);
          setArgs({ value: options[5].value });
        });
      }, 1000);
    }, [numberOfOptions, setArgs]);

    const { onChange, ...rest } = args;
    return (
      <Field label="Test input" description={options.length ? 'Input with a few options' : 'Preparing options...'}>
        <Combobox
          {...rest}
          {...dynamicArgs}
          options={options}
          onChange={(value: ComboboxOption | null) => {
            setArgs({ value: value?.value || null });
            onChangeAction(value);
          }}
        />
      </Field>
    );
  },
};

function loadOptionsWithLabels(inputValue: string) {
  loadOptionsAction(inputValue);
  return fakeSearchAPI(`http://example.com/search?errorOnQuery=break&query=${inputValue}`);
}

export const AsyncOptionsWithLabels: Story = {
  name: 'Async - values + labels',
  args: {
    options: loadOptionsWithLabels,
    value: { label: 'Option 69', value: '69' },
    placeholder: 'Select an option',
  },
  render: function AsyncOptionsWithLabels(args: PropsAndCustomArgs) {
    const [dynamicArgs, setArgs] = useArgs();

    return (
      <Field
        label='Async options fn returns objects like { label: "Option 69", value: "69" }'
        description="Search for 'break' to see an error"
      >
        <Combobox
          {...args}
          {...dynamicArgs}
          onChange={(value: ComboboxOption | null) => {
            onChangeAction(value);
            setArgs({ value });
          }}
        />
      </Field>
    );
  },
};

function loadOptionsOnlyValues(inputValue: string) {
  loadOptionsAction(inputValue);
  return fakeSearchAPI(`http://example.com/search?errorOnQuery=break&query=${inputValue}`).then((options) =>
    options.map((opt) => ({ value: opt.label! }))
  );
}

export const AsyncOptionsWithOnlyValues: Story = {
  name: 'Async - values only',
  args: {
    options: loadOptionsOnlyValues,
    value: { value: 'Option 69' },
    placeholder: 'Select an option',
  },
  render: function AsyncOptionsWithOnlyValues(args: PropsAndCustomArgs) {
    const [dynamicArgs, setArgs] = useArgs();

    return (
      <Field
        label='Async options fn returns objects like { value: "69" }'
        description="Search for 'break' to see an error"
      >
        <Combobox
          {...args}
          {...dynamicArgs}
          onChange={(value: ComboboxOption | null) => {
            onChangeAction(value);
            setArgs({ value });
          }}
        />
      </Field>
    );
  },
};

const noop = () => {};

export const PositioningTest: Story = {
  render: (args: PropsAndCustomArgs) => {
    if (typeof args.options === 'function') {
      throw new Error('This story does not support async options');
    }

    function renderColumnOfComboboxes(pos: string) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: 1,
          }}
        >
          <Combobox {...args} placeholder={`${pos} top`} options={args.options} value={null} onChange={noop} />
          <Combobox {...args} placeholder={`${pos} middle`} options={args.options} value={null} onChange={noop} />
          <Combobox {...args} placeholder={`${pos} bottom`} options={args.options} value={null} onChange={noop} />
        </div>
      );
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',

          // approx the height of the dev alert, and three margins. exact doesn't matter
          minHeight: 'calc(100vh - (105px + 16px + 16px + 16px))',
          justifyContent: 'space-between',
          gap: 32,
        }}
      >
        {renderColumnOfComboboxes('Left')}
        {renderColumnOfComboboxes('Middle')}
        {renderColumnOfComboboxes('Right')}
      </div>
    );
  },
};
