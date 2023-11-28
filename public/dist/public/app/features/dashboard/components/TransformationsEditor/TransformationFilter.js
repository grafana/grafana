import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { Field, useStyles2 } from '@grafana/ui';
import { FrameSelectionEditor } from 'app/plugins/panel/geomap/editor/FrameSelectionEditor';
export const TransformationFilter = ({ index, data, config, onChange }) => {
    const styles = useStyles2(getStyles);
    const context = useMemo(() => {
        // eslint-disable-next-line
        return { data };
    }, [data]);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(Field, { label: "Apply transformation to" },
            React.createElement(FrameSelectionEditor, { value: config.filter, context: context, 
                // eslint-disable-next-line
                item: {}, onChange: (filter) => onChange(index, Object.assign(Object.assign({}, config), { filter })) }))));
};
const getStyles = (theme) => {
    const borderRadius = theme.shape.radius.default;
    return {
        wrapper: css `
      padding: ${theme.spacing(2)};
      border: 2px solid ${theme.colors.background.secondary};
      border-top: none;
      border-radius: 0 0 ${borderRadius} ${borderRadius};
      position: relative;
      top: -4px;
    `,
    };
};
//# sourceMappingURL=TransformationFilter.js.map