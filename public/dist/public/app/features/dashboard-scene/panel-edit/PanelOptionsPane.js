import { css } from '@emotion/css';
import React from 'react';
import { SceneObjectBase } from '@grafana/scenes';
import { Field, Input, useStyles2 } from '@grafana/ui';
export class PanelOptionsPane extends SceneObjectBase {
    constructor(panel) {
        super({});
        this.panel = panel;
    }
}
PanelOptionsPane.Component = ({ model }) => {
    const { panel } = model;
    const { title } = panel.useState();
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.box },
        React.createElement(Field, { label: "Title" },
            React.createElement(Input, { value: title, onChange: (evt) => panel.setState({ title: evt.currentTarget.value }) }))));
};
function getStyles(theme) {
    return {
        box: css({
            display: 'flex',
            flexDirection: 'column',
            padding: theme.spacing(2),
            flexBasis: '100%',
            flexGrow: 1,
            minHeight: 0,
        }),
    };
}
//# sourceMappingURL=PanelOptionsPane.js.map