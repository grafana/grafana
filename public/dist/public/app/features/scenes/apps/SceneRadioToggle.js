import React from 'react';
import { SceneObjectBase } from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';
export class SceneRadioToggle extends SceneObjectBase {
    constructor() {
        super(...arguments);
        this.onChange = (value) => {
            this.setState({ value });
            this.state.onChange(value);
        };
    }
}
SceneRadioToggle.Component = ({ model }) => {
    const { options, value } = model.useState();
    return React.createElement(RadioButtonGroup, { options: options, value: value, onChange: model.onChange });
};
//# sourceMappingURL=SceneRadioToggle.js.map