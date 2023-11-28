import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { ConfigSubSection } from '@grafana/experimental';
import { Button, useTheme2 } from '@grafana/ui';
import { overhaulStyles } from './ConfigEditor';
import ExemplarSetting from './ExemplarSetting';
export function ExemplarsSettings({ options, onChange, disabled }) {
    const theme = useTheme2();
    const styles = overhaulStyles(theme);
    return (React.createElement("div", { className: styles.sectionBottomPadding },
        React.createElement(ConfigSubSection, { title: "Exemplars", className: styles.container },
            options &&
                options.map((option, index) => {
                    return (React.createElement(ExemplarSetting, { key: index, value: option, onChange: (newField) => {
                            const newOptions = [...options];
                            newOptions.splice(index, 1, newField);
                            onChange(newOptions);
                        }, onDelete: () => {
                            const newOptions = [...options];
                            newOptions.splice(index, 1);
                            onChange(newOptions);
                        }, disabled: disabled }));
                }),
            !disabled && (React.createElement(Button, { variant: "secondary", "aria-label": selectors.components.DataSource.Prometheus.configPage.exemplarsAddButton, className: css `
              margin-bottom: 10px;
            `, icon: "plus", onClick: (event) => {
                    event.preventDefault();
                    const newOptions = [...(options || []), { name: 'traceID' }];
                    onChange(newOptions);
                } }, "Add")),
            disabled && !options && React.createElement("i", null, "No exemplars configurations"))));
}
//# sourceMappingURL=ExemplarsSettings.js.map