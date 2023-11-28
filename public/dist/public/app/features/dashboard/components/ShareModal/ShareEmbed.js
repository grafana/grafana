import React, { PureComponent } from 'react';
import { reportInteraction } from '@grafana/runtime/src';
import { ClipboardButton, Field, Modal, Switch, TextArea } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { ThemePicker } from './ThemePicker';
import { buildIframeHtml } from './utils';
export class ShareEmbed extends PureComponent {
    constructor(props) {
        super(props);
        this.buildIframeHtml = () => {
            const { panel, dashboard } = this.props;
            const { useCurrentTimeRange, selectedTheme } = this.state;
            const iframeHtml = buildIframeHtml(useCurrentTimeRange, dashboard.uid, selectedTheme, panel);
            this.setState({ iframeHtml });
        };
        this.onIframeHtmlChange = (event) => {
            this.setState({ iframeHtml: event.currentTarget.value });
        };
        this.onUseCurrentTimeRangeChange = () => {
            this.setState({
                useCurrentTimeRange: !this.state.useCurrentTimeRange,
            }, this.buildIframeHtml);
        };
        this.onThemeChange = (value) => {
            this.setState({ selectedTheme: value }, this.buildIframeHtml);
        };
        this.getIframeHtml = () => {
            return this.state.iframeHtml;
        };
        this.state = {
            useCurrentTimeRange: true,
            selectedTheme: 'current',
            iframeHtml: '',
        };
    }
    componentDidMount() {
        reportInteraction('grafana_dashboards_embed_share_viewed');
        this.buildIframeHtml();
    }
    render() {
        const { useCurrentTimeRange, selectedTheme, iframeHtml } = this.state;
        const isRelativeTime = this.props.dashboard ? this.props.dashboard.time.to === 'now' : false;
        const timeRangeDescription = isRelativeTime
            ? t('share-modal.embed.time-range-description', 'Transforms the current relative time range to an absolute time range')
            : '';
        return (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "share-modal-info-text" },
                React.createElement(Trans, { i18nKey: "share-modal.embed.info" }, "Generate HTML for embedding an iframe with this panel.")),
            React.createElement(Field, { label: t('share-modal.embed.time-range', 'Current time range'), description: timeRangeDescription },
                React.createElement(Switch, { id: "share-current-time-range", value: useCurrentTimeRange, onChange: this.onUseCurrentTimeRangeChange })),
            React.createElement(ThemePicker, { selectedTheme: selectedTheme, onChange: this.onThemeChange }),
            React.createElement(Field, { label: t('share-modal.embed.html', 'Embed HTML'), description: t('share-modal.embed.html-description', 'The HTML code below can be pasted and included in another web page. Unless anonymous access is enabled, the user viewing that page need to be signed into Grafana for the graph to load.') },
                React.createElement(TextArea, { "data-testid": "share-embed-html", id: "share-panel-embed-embed-html-textarea", rows: 5, value: iframeHtml, onChange: this.onIframeHtmlChange })),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(ClipboardButton, { icon: "copy", variant: "primary", getText: this.getIframeHtml },
                    React.createElement(Trans, { i18nKey: "share-modal.embed.copy" }, "Copy to clipboard")))));
    }
}
//# sourceMappingURL=ShareEmbed.js.map