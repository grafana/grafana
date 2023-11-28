import { css, cx } from '@emotion/css';
import React from 'react';
import { Segment } from '@grafana/ui';
import { describeMetric } from '../utils';
const noWrap = css `
  white-space: nowrap;
`;
const toOption = (metric) => ({
    label: describeMetric(metric),
    value: metric,
});
const toOptions = (metrics) => metrics.map(toOption);
export const MetricPicker = ({ options, onChange, className, value }) => {
    const selectedOption = options.find((option) => option.id === value);
    return (React.createElement(Segment, { className: cx(className, noWrap), options: toOptions(options), onChange: onChange, placeholder: "Select Metric", value: !!selectedOption ? toOption(selectedOption) : undefined }));
};
//# sourceMappingURL=MetricPicker.js.map