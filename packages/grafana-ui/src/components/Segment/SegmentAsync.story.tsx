import { action } from '@storybook/addon-actions';
import { ComponentMeta } from '@storybook/react';
import React, { useState } from 'react';
import { AsyncState } from 'react-use/lib/useAsync';

import { SelectableValue } from '@grafana/data';
import { SegmentAsync, Icon, SegmentSection } from '@grafana/ui';

const AddButton = (
  <a className="gf-form-label query-part">
    <Icon name="plus" />
  </a>
);

const toOption = (value: any) => ({ label: value, value: value });
const options = ['Option1', 'Option2', 'OptionWithLooongLabel', 'Option4'].map(toOption);

const loadOptions = (options: any): Promise<Array<SelectableValue<string>>> =>
  new Promise((res) => setTimeout(() => res(options), 2000));

const loadOptionsErr = (): Promise<Array<SelectableValue<string>>> =>
  new Promise((_, rej) => setTimeout(() => rej(Error('Could not find data')), 2000));

const SegmentFrame = ({ loadOptions, children }: any) => (
  <>
    <SegmentSection label="Segment Name">
      {children}
      <SegmentAsync
        Component={AddButton}
        onChange={(value) => action('New value added')(value)}
        loadOptions={() => loadOptions(options)}
      />
    </SegmentSection>
  </>
);

export const ArrayOptions = () => {
  const [value, setValue] = useState<any>(options[0]);
  return (
    <SegmentFrame loadOptions={() => loadOptions(options)}>
      <SegmentAsync
        value={value}
        loadOptions={() => loadOptions(options)}
        onChange={(item) => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

const meta: ComponentMeta<typeof SegmentAsync> = {
  title: 'Data Source/Segment/SegmentAsync',
  component: SegmentAsync,
};

export const ArrayOptionsWithPrimitiveValue = () => {
  const [value, setValue] = useState(options[0].value);
  return (
    <SegmentFrame loadOptions={() => loadOptions(options)}>
      <SegmentAsync
        value={value}
        loadOptions={() => loadOptions(options)}
        onChange={({ value }) => {
          setValue(value);
          action('Segment value changed')(value);
        }}
      />
    </SegmentFrame>
  );
};

const groupedOptions: any = [
  { label: 'Names', options: ['Jane', 'Tom', 'Lisa'].map(toOption) },
  { label: 'Prime', options: [2, 3, 5, 7, 11, 13].map(toOption) },
];

export const GroupedArrayOptions = () => {
  const [value, setValue] = useState(groupedOptions[0].options[0]);
  return (
    <SegmentFrame loadOptions={() => loadOptions(groupedOptions)}>
      <SegmentAsync
        value={value}
        loadOptions={() => loadOptions(groupedOptions)}
        onChange={(item) => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

export const CustomOptionsAllowed = () => {
  const [value, setValue] = useState(groupedOptions[0].options[0]);
  return (
    <SegmentFrame loadOptions={() => loadOptions(groupedOptions)}>
      <SegmentAsync
        allowCustomValue
        value={value}
        loadOptions={() => loadOptions(options)}
        onChange={(item) => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

const CustomLabelComponent = ({ value }: any) => <div className="gf-form-label">custom({value})</div>;

export const CustomLabel = () => {
  const [value, setValue] = useState(groupedOptions[0].options[0].value);
  return (
    <SegmentFrame loadOptions={() => loadOptions(groupedOptions)}>
      <SegmentAsync
        Component={<CustomLabelComponent value={value} />}
        loadOptions={() => loadOptions(groupedOptions)}
        onChange={({ value }) => {
          setValue(value);
          action('Segment value changed')(value);
        }}
      />
    </SegmentFrame>
  );
};

export const CustomStateMessageHandler = () => {
  const stateToTextFunction = (state: AsyncState<Array<SelectableValue<string>>>) => {
    if (state.loading) {
      return "You're going too fast for me, please wait...";
    }

    if (state.error) {
      return 'Outch ! We encountered an error...';
    }

    if (!Array.isArray(state.value) || state.value.length === 0) {
      return 'It is empty :)';
    }

    return '';
  };

  const [value, setValue] = useState<any>(options[0]);
  return (
    <>
      <SegmentFrame loadOptions={() => loadOptions(groupedOptions)}>
        <SegmentAsync
          value={value}
          noOptionMessageHandler={stateToTextFunction}
          loadOptions={() => loadOptions(groupedOptions)}
          onChange={({ value }) => {
            setValue(value);
            action('Segment value changed')(value);
          }}
        />
      </SegmentFrame>
      <SegmentFrame loadOptions={() => loadOptions([])}>
        <SegmentAsync
          value={value}
          noOptionMessageHandler={stateToTextFunction}
          loadOptions={() => loadOptions([])}
          onChange={({ value }) => {
            setValue(value);
            action('Segment value changed')(value);
          }}
        />
      </SegmentFrame>
      <SegmentFrame loadOptions={() => loadOptionsErr()}>
        <SegmentAsync
          value={value}
          noOptionMessageHandler={stateToTextFunction}
          loadOptions={() => loadOptionsErr()}
          onChange={({ value }) => {
            setValue(value);
            action('Segment value changed')(value);
          }}
        />
      </SegmentFrame>
    </>
  );
};

export const HtmlAttributes = () => {
  const [value, setValue] = useState<any>(options[0]);
  return (
    <SegmentFrame loadOptions={() => loadOptions(options)}>
      <SegmentAsync
        data-testid="segment-async-test"
        id="segment-async"
        value={value}
        loadOptions={() => loadOptions(options)}
        onChange={(item) => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

export default meta;
