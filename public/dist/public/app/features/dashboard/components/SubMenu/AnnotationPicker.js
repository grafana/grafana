import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';
import { LoadingIndicator } from '@grafana/ui/src/components/PanelChrome/LoadingIndicator';
import { AnnotationQueryFinished, AnnotationQueryStarted } from '../../../../types/events';
import { getDashboardQueryRunner } from '../../../query/state/DashboardQueryRunner/DashboardQueryRunner';
export const AnnotationPicker = ({ annotation, events, onEnabledChanged }) => {
    const [loading, setLoading] = useState(false);
    const styles = useStyles2(getStyles);
    const onCancel = () => getDashboardQueryRunner().cancel(annotation);
    useEffect(() => {
        const started = events.getStream(AnnotationQueryStarted).subscribe({
            next: (event) => {
                if (event.payload === annotation) {
                    setLoading(true);
                }
            },
        });
        const stopped = events.getStream(AnnotationQueryFinished).subscribe({
            next: (event) => {
                if (event.payload === annotation) {
                    setLoading(false);
                }
            },
        });
        return () => {
            started.unsubscribe();
            stopped.unsubscribe();
        };
    });
    return (React.createElement("div", { key: annotation.name, className: styles.annotation },
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: annotation.name, disabled: loading, "data-testid": selectors.pages.Dashboard.SubMenu.Annotations.annotationLabel(annotation.name) },
                React.createElement(InlineSwitch, { label: annotation.name, value: annotation.enable, onChange: () => onEnabledChanged(annotation), disabled: loading, "data-testid": selectors.pages.Dashboard.SubMenu.Annotations.annotationToggle(annotation.name) })),
            React.createElement("div", { className: styles.indicator },
                React.createElement(LoadingIndicator, { loading: loading, onCancel: onCancel })))));
};
function getStyles(theme) {
    return {
        annotation: css `
      display: inline-block;
      margin-right: ${theme.spacing(1)};

      .fa-caret-down {
        font-size: 75%;
        padding-left: ${theme.spacing(1)};
      }

      .gf-form-inline .gf-form {
        margin-bottom: 0;
      }
    `,
        indicator: css `
      align-self: center;
      padding: 0 ${theme.spacing(0.5)};
    `,
    };
}
//# sourceMappingURL=AnnotationPicker.js.map