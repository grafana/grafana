import React, { useState, useEffect } from 'react';
import { Select } from './Select';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../../utils/storybook/withCenteredStory';
import { withStoryContainer } from '../../../utils/storybook/withStoryContainer';
import { SelectableValue } from '@grafana/data';
import { getAvailableIcons, IconType } from '../../Icon/types';
import { select } from '@storybook/addon-knobs';
import { Icon } from '../../Icon/Icon';

export default {
  title: 'UI/Forms/Select',
  component: Select,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  // parameters: {
  //   docs: {
  //     page: mdx,
  //   },
  // },
};

export const simple = () => {
  const [value, setValue] = useState<SelectableValue<string>>();

  console.log(value);

  const prefixSuffixOpts = {
    None: null,
    Text: '$',
    ...getAvailableIcons().reduce<Record<string, string>>((prev, c) => {
      return {
        ...prev,
        [`Icon: ${c}`]: `icon-${c}`,
      };
    }, {}),
  };
  const VISUAL_GROUP = 'Visual options';
  // ---
  const prefix = select('Prefix', prefixSuffixOpts, null, VISUAL_GROUP);

  let prefixEl: any = prefix;
  if (prefix && prefix.match(/icon-/g)) {
    prefixEl = <Icon name={prefix.replace(/icon-/g, '') as IconType} />;
  }
  return (
    <div>
      <Select
        options={[
          {
            label: 'Prometheus is a veeeeeeeeeeeeeery long value',
            value: 'prometheus',
          },
          {
            label: 'Graphite',
            value: 'graphite',
          },
          {
            label: 'InlufxDB',
            value: 'inlufxdb',
          },
        ]}
        value={value}
        onChange={v => {
          setValue(v);
        }}
        size="md"
        prefix={prefixEl}
        allowCustomValue
      />
      <h1>test</h1>
    </div>
  );
};
