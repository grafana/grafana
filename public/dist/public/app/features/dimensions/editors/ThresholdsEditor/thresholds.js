import React from 'react';
import { ThresholdsMode } from '@grafana/data';
import { ThresholdsEditor } from './ThresholdsEditor';
export class ThresholdsValueEditor extends React.PureComponent {
    constructor(props) {
        super(props);
    }
    render() {
        const { onChange } = this.props;
        let value = this.props.value;
        if (!value) {
            value = {
                mode: ThresholdsMode.Percentage,
                // Must be sorted by 'value', first value is always -Infinity
                steps: [
                // anything?
                ],
            };
        }
        return React.createElement(ThresholdsEditor, { thresholds: value, onChange: onChange });
    }
}
//# sourceMappingURL=thresholds.js.map