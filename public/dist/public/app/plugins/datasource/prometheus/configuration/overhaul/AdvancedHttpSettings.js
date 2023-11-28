import { css, cx } from '@emotion/css';
import React from 'react';
import { ConfigSubSection } from '@grafana/experimental';
import { InlineField, Input, TagsInput } from '@grafana/ui';
import { PROM_CONFIG_LABEL_WIDTH } from '../ConfigEditor';
// @ts-ignore
export const AdvancedHttpSettings = ({ config, onChange, className, }) => {
    const onCookiesChange = (cookies) => {
        onChange(Object.assign(Object.assign({}, config), { jsonData: Object.assign(Object.assign({}, config.jsonData), { keepCookies: cookies }) }));
    };
    const onTimeoutChange = (event) => {
        onChange(Object.assign(Object.assign({}, config), { jsonData: Object.assign(Object.assign({}, config.jsonData), { timeout: parseInt(event.currentTarget.value, 10) }) }));
    };
    const styles = {
        container: css({
            maxWidth: 578,
        }),
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(ConfigSubSection, { title: "Advanced HTTP settings", className: cx(styles.container, className) },
            React.createElement(InlineField, { htmlFor: "advanced-http-cookies", label: "Allowed cookies", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: "Grafana proxy deletes forwarded cookies by default. Specify cookies by name that should be forwarded to the data source.", disabled: config.readOnly, grow: true },
                React.createElement(TagsInput, { className: "width-20", id: "advanced-http-cookies", placeholder: "New cookie (hit enter to add)", tags: config.jsonData.keepCookies, onChange: onCookiesChange })),
            React.createElement(InlineField, { htmlFor: "advanced-http-timeout", label: "Timeout", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: "HTTP request timeout in seconds", disabled: config.readOnly, grow: true },
                React.createElement(Input, { className: "width-20", id: "advanced-http-timeout", type: "number", min: 0, placeholder: "Timeout in seconds", "aria-label": "Timeout in seconds", value: config.jsonData.timeout, onChange: onTimeoutChange })))));
};
//# sourceMappingURL=AdvancedHttpSettings.js.map