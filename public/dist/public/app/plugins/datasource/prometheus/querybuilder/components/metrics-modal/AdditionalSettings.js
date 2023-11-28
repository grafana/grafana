import { css } from '@emotion/css';
import React from 'react';
import { Icon, Switch, Tooltip, useTheme2 } from '@grafana/ui';
import { testIds } from './MetricsModal';
import { placeholders } from './state/helpers';
export function AdditionalSettings(props) {
    const { state, onChangeFullMetaSearch, onChangeIncludeNullMetadata, onChangeDisableTextWrap, onChangeUseBackend } = props;
    const theme = useTheme2();
    const styles = getStyles(theme);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.selectItem },
            React.createElement(Switch, { "data-testid": testIds.searchWithMetadata, value: state.fullMetaSearch, disabled: state.useBackend || !state.hasMetadata, onChange: () => onChangeFullMetaSearch() }),
            React.createElement("div", { className: styles.selectItemLabel }, placeholders.metadataSearchSwitch)),
        React.createElement("div", { className: styles.selectItem },
            React.createElement(Switch, { value: state.includeNullMetadata, disabled: !state.hasMetadata, onChange: () => onChangeIncludeNullMetadata() }),
            React.createElement("div", { className: styles.selectItemLabel }, placeholders.includeNullMetadata)),
        React.createElement("div", { className: styles.selectItem },
            React.createElement(Switch, { value: state.disableTextWrap, onChange: () => onChangeDisableTextWrap() }),
            React.createElement("div", { className: styles.selectItemLabel }, "Disable text wrap")),
        React.createElement("div", { className: styles.selectItem },
            React.createElement(Switch, { "data-testid": testIds.setUseBackend, value: state.useBackend, onChange: () => onChangeUseBackend() }),
            React.createElement("div", { className: styles.selectItemLabel },
                placeholders.setUseBackend,
                "\u00A0"),
            React.createElement(Tooltip, { content: 'Filter metric names by regex search, using an additional call on the Prometheus API.', placement: "bottom-end" },
                React.createElement(Icon, { name: "info-circle", size: "xs", className: styles.settingsIcon })))));
}
function getStyles(theme) {
    return {
        settingsIcon: css `
      color: ${theme.colors.text.secondary};
    `,
        selectItem: css `
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 4px 0;
    `,
        selectItemLabel: css `
      margin: 0 0 0 ${theme.spacing(1)};
      align-self: center;
      color: ${theme.colors.text.secondary};
      font-size: 12px;
    `,
    };
}
//# sourceMappingURL=AdditionalSettings.js.map