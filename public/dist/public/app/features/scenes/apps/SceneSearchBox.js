import React from 'react';
import { SceneObjectBase } from '@grafana/scenes';
import { Input } from '@grafana/ui';
export class SceneSearchBox extends SceneObjectBase {
    constructor() {
        super(...arguments);
        this.onChange = (evt) => {
            this.setState({ value: evt.currentTarget.value });
        };
    }
}
SceneSearchBox.Component = ({ model }) => {
    const { value } = model.useState();
    return React.createElement(Input, { width: 25, placeholder: "Search...", value: value, onChange: model.onChange });
};
//# sourceMappingURL=SceneSearchBox.js.map