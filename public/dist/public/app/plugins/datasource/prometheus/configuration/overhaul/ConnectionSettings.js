import { css, cx } from '@emotion/css';
import React from 'react';
import { ConfigSection } from '@grafana/experimental';
import { InlineField, Input } from '@grafana/ui';
// @ts-ignore
export const ConnectionSettings = ({ config, onChange, description, urlPlaceholder, urlTooltip, urlLabel, className, }) => {
    const isValidUrl = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(config.url);
    const styles = {
        container: css({
            maxWidth: 578,
        }),
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(ConfigSection, { title: "Connection", description: description, className: cx(styles.container, className) },
            React.createElement(InlineField, { htmlFor: "connection-url", label: urlLabel || 'URL', labelWidth: 24, tooltip: urlTooltip || (React.createElement(React.Fragment, null,
                    "Specify a complete HTTP URL",
                    React.createElement("br", null),
                    "(for example https://example.com:8080)")), grow: true, disabled: config.readOnly, required: true, invalid: !isValidUrl && !config.readOnly, error: isValidUrl ? '' : 'Please enter a valid URL', interactive: true },
                React.createElement(Input, { id: "connection-url", "aria-label": "Datasource HTTP settings url", onChange: (event) => onChange(Object.assign(Object.assign({}, config), { url: event.currentTarget.value })), value: config.url || '', placeholder: urlPlaceholder || 'URL' })))));
};
//# sourceMappingURL=ConnectionSettings.js.map