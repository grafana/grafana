import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, InlineFieldRow, InlineLabel, useStyles2 } from '@grafana/ui';
export const VariableValuesPreview = ({ variable: { options } }) => {
    const [previewLimit, setPreviewLimit] = useState(20);
    const [previewOptions, setPreviewOptions] = useState([]);
    const showMoreOptions = useCallback((event) => {
        event.preventDefault();
        setPreviewLimit(previewLimit + 20);
    }, [previewLimit, setPreviewLimit]);
    const styles = useStyles2(getStyles);
    useEffect(() => setPreviewOptions(options.slice(0, previewLimit)), [previewLimit, options]);
    if (!previewOptions.length) {
        return null;
    }
    return (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', marginTop: '16px' } },
        React.createElement("h5", null, "Preview of values"),
        React.createElement(InlineFieldRow, null, previewOptions.map((o, index) => (React.createElement(InlineFieldRow, { key: `${o.value}-${index}`, className: styles.optionContainer },
            React.createElement(InlineLabel, { "aria-label": selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption },
                React.createElement("div", { className: styles.label }, o.text)))))),
        options.length > previewLimit && (React.createElement(InlineFieldRow, { className: styles.optionContainer },
            React.createElement(Button, { onClick: showMoreOptions, variant: "secondary", size: "sm", "aria-label": "Variable editor Preview of Values Show More link" }, "Show more")))));
};
VariableValuesPreview.displayName = 'VariableValuesPreview';
function getStyles(theme) {
    return {
        wrapper: css({
            display: 'flex',
            flexDirection: 'column',
            marginTop: theme.spacing(2),
        }),
        optionContainer: css({
            marginLeft: theme.spacing(0.5),
            marginBottom: theme.spacing(0.5),
        }),
        label: css({
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '50vw',
        }),
    };
}
//# sourceMappingURL=VariableValuesPreview.js.map