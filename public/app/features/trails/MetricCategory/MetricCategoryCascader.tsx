import React, { useMemo, useReducer, useState } from 'react';

import { Cascader, CascaderOption, HorizontalGroup, Button } from '@grafana/ui';

import { useMetricCategories } from './useMetricCategories';

type Props = {
  metricNames: string[];
  onSelect: (prefix: string | undefined) => void;
  disabled?: boolean;
  initialValue?: string;
};

export function MetricCategoryCascader({ metricNames, onSelect, disabled, initialValue }: Props) {
  const categoryTree = useMetricCategories(metricNames);
  const options = useMemo(() => createCasaderOptions(categoryTree), [categoryTree]);

  const [disableClear, setDisableClear] = useState(initialValue == null);

  // Increments whenever clear is pressed, to reset the Cascader component
  const [cascaderKey, resetCascader] = useReducer((x) => x + 1, 0);

  const clear = () => {
    resetCascader();
    setDisableClear(true);
    onSelect(undefined);
  };

  return (
    <HorizontalGroup>
      <Cascader
        key={cascaderKey} // To reset the component to `undefined`
        displayAllSelectedLevels={true}
        width={40}
        separator="_"
        hideActiveLevelLabel={false}
        placeholder={'No filter'}
        onSelect={(prefix) => {
          setDisableClear(!prefix);
          onSelect(prefix);
        }}
        {...{ options, disabled, initialValue }}
      />
      <Button disabled={disableClear || disabled} onClick={clear} variant="secondary">
        Clear
      </Button>
    </HorizontalGroup>
  );
}

function createCasaderOptions(tree: ReturnType<typeof useMetricCategories>, currentPrefix = '') {
  const categories = Object.entries(tree.children);

  const options = categories.map(([metricPart, node]) => {
    let subcategoryEntries = Object.entries(node.children);

    while (subcategoryEntries.length === 1 && !node.isMetric) {
      // There is only one subcategory, so we will join it with the current metricPart to reduce depth
      const [subMetricPart, subNode] = subcategoryEntries[0];
      metricPart = `${metricPart}_${subMetricPart}`;
      // Extend the metric part name, because there is only one subcategory
      node = subNode;
      subcategoryEntries = Object.entries(node.children);
    }

    const value = currentPrefix + metricPart;
    const subOptions = createCasaderOptions(node, value + '_');

    const option: CascaderOption = {
      value: value,
      label: metricPart,
      items: subOptions,
    };

    return option;
  });

  return options;
}
