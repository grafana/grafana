import React, { useCallback } from 'react';
import { PieChart } from '@grafana/ui';
import { PieChartOptions } from './types';
import {
  ByNamesMatcherMode,
  DynamicConfigValue,
  FieldMatcherID,
  isSystemOverrideWithRef,
  PanelProps,
  SystemConfigOverrideRule,
} from '@grafana/data';
import { changeSeriesColorConfigFactory } from '../timeseries/overrides/colorSeriesConfigFactory';

interface Props extends PanelProps<PieChartOptions> {}

export const PieChartPanel: React.FC<Props> = ({
  width,
  height,
  options,
  data,
  onFieldConfigChange,
  replaceVariables,
  fieldConfig,
  timeZone,
}) => {
  const onLabelClick = useCallback(
    (label: string) => {
      const displayOverrideRef = 'hideSeriesFrom';
      const isHideSeriesOverride = isSystemOverrideWithRef(displayOverrideRef);
      const hideFromIndex = fieldConfig.overrides.findIndex(isHideSeriesOverride);
      if (hideFromIndex < 0) {
        const override = createOverride([label]);
        onFieldConfigChange({ ...fieldConfig, overrides: [...fieldConfig.overrides, override] });
      } else {
        const overridesCopy = Array.from(fieldConfig.overrides);
        const [current] = overridesCopy.splice(hideFromIndex, 1) as SystemConfigOverrideRule[];
        const existing = getExistingDisplayNames(current);
        const index = existing.findIndex((name) => name === label);
        if (index < 0) {
          existing.push(label);
        } else {
          existing.splice(index, 1);
        }
        const override = createOverride(existing);
        onFieldConfigChange({ ...fieldConfig, overrides: [...overridesCopy, override] });
      }
    },
    [fieldConfig, onFieldConfigChange]
  );

  const onSeriesColorChange = useCallback(
    (label: string, color: string) => {
      onFieldConfigChange(changeSeriesColorConfigFactory(label, color, fieldConfig));
    },
    [fieldConfig, onFieldConfigChange]
  );

  return (
    <PieChart
      width={width}
      height={height}
      timeZone={timeZone}
      fieldConfig={fieldConfig}
      reduceOptions={options.reduceOptions}
      replaceVariables={replaceVariables}
      onLabelClick={onLabelClick}
      data={data.series}
      onSeriesColorChange={onSeriesColorChange}
      pieType={options.pieType}
      displayLabels={options.displayLabels}
      legendOptions={options.legend}
      tooltipOptions={options.tooltip}
    />
  );
};

function createOverride(names: string[], property?: DynamicConfigValue): SystemConfigOverrideRule {
  property = property ?? {
    id: 'custom.hideFrom',
    value: {
      graph: true,
      legend: false,
      tooltip: false,
    },
  };

  return {
    __systemRef: 'hideSeriesFrom',
    matcher: {
      id: FieldMatcherID.byNames,
      options: {
        mode: ByNamesMatcherMode.include,
        names: names,
        readOnly: true,
      },
    },
    properties: [
      {
        ...property,
        value: {
          graph: true,
          legend: false,
          tooltip: false,
        },
      },
    ],
  };
}

const getExistingDisplayNames = (rule: SystemConfigOverrideRule): string[] => {
  const names = rule.matcher.options?.names;
  if (!Array.isArray(names)) {
    return [];
  }
  return names;
};
