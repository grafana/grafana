import { css } from '@emotion/css';
import React, { useMemo, useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FeatureState } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Drawer, Tab, TabsBar, CodeEditor, useStyles2, Field, HorizontalGroup, InlineSwitch, Button, Spinner, Alert, FeatureBadge, Select, ClipboardButton, Icon, } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import { ShowMessage, SnapshotTab, SupportSnapshotService } from './SupportSnapshotService';
export function HelpWizard({ panel, plugin, onClose }) {
    const styles = useStyles2(getStyles);
    const service = useMemo(() => new SupportSnapshotService(panel), [panel]);
    const { currentTab, loading, error, options, showMessage, snapshotSize, markdownText, snapshotText, randomize, panelTitle, scene, } = service.useState();
    useEffect(() => {
        service.buildDebugDashboard();
    }, [service, plugin, randomize]);
    if (!plugin) {
        return null;
    }
    const tabs = [
        { label: 'Snapshot', value: SnapshotTab.Support },
        { label: 'Data', value: SnapshotTab.Data },
    ];
    const hasSupportBundleAccess = config.supportBundlesEnabled && contextSrv.hasPermission(AccessControlAction.ActionSupportBundlesCreate);
    return (React.createElement(Drawer, { title: `Get help with this panel`, size: "lg", onClose: onClose, subtitle: React.createElement(Stack, { direction: "column", gap: 1 },
            React.createElement(Stack, { direction: "row", gap: 1 },
                React.createElement(FeatureBadge, { featureState: FeatureState.beta }),
                React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/troubleshooting/", target: "blank", className: "external-link", rel: "noopener noreferrer" },
                    "Troubleshooting docs ",
                    React.createElement(Icon, { name: "external-link-alt" }))),
            React.createElement("span", { className: "muted" }, "To request troubleshooting help, send a snapshot of this panel to Grafana Labs Technical Support. The snapshot contains query response data and panel settings."),
            hasSupportBundleAccess && (React.createElement("span", { className: "muted" },
                "You can also retrieve a support bundle containing information concerning your Grafana instance and configured datasources in the ",
                React.createElement("a", { href: "/support-bundles" }, "support bundles section"),
                "."))), tabs: React.createElement(TabsBar, null, tabs.map((t, index) => (React.createElement(Tab, { key: `${t.value}-${index}`, label: t.label, active: t.value === currentTab, onChangeTab: () => service.onCurrentTabChange(t.value) })))) },
        loading && React.createElement(Spinner, null),
        error && React.createElement(Alert, { title: error.title }, error.message),
        currentTab === SnapshotTab.Data && (React.createElement("div", { className: styles.code },
            React.createElement("div", { className: styles.opts },
                React.createElement(Field, { label: "Template", className: styles.field },
                    React.createElement(Select, { options: options, value: showMessage, onChange: service.onShowMessageChange })),
                showMessage === ShowMessage.GithubComment ? (React.createElement(ClipboardButton, { icon: "copy", getText: service.onGetMarkdownForClipboard }, "Copy to clipboard")) : (React.createElement(Button, { icon: "download-alt", onClick: service.onDownloadDashboard },
                    "Download (",
                    snapshotSize,
                    ")"))),
            React.createElement(AutoSizer, { disableWidth: true }, ({ height }) => (React.createElement(CodeEditor, { width: "100%", height: height, language: showMessage === ShowMessage.GithubComment ? 'markdown' : 'json', showLineNumbers: true, showMiniMap: true, value: showMessage === ShowMessage.GithubComment ? markdownText : snapshotText, readOnly: false, onBlur: service.onSetSnapshotText }))))),
        currentTab === SnapshotTab.Support && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "Randomize data", description: "Modify the original data to hide sensitve information.  Note the lengths will stay the same, and duplicate values will be equal." },
                React.createElement(HorizontalGroup, null,
                    React.createElement(InlineSwitch, { label: "Labels", id: "randomize-labels", showLabel: true, value: Boolean(randomize.labels), onChange: () => service.onToggleRandomize('labels') }),
                    React.createElement(InlineSwitch, { label: "Field names", id: "randomize-field-names", showLabel: true, value: Boolean(randomize.names), onChange: () => service.onToggleRandomize('names') }),
                    React.createElement(InlineSwitch, { label: "String values", id: "randomize-string-values", showLabel: true, value: Boolean(randomize.values), onChange: () => service.onToggleRandomize('values') }))),
            React.createElement(Field, { label: "Support snapshot", description: `Panel: ${panelTitle}` },
                React.createElement(Stack, null,
                    React.createElement(Button, { icon: "download-alt", onClick: service.onDownloadDashboard },
                        "Dashboard (",
                        snapshotSize,
                        ")"),
                    React.createElement(ClipboardButton, { icon: "github", getText: service.onGetMarkdownForClipboard, title: "Copy a complete GitHub comment to the clipboard" }, "Copy to clipboard"),
                    React.createElement(Button, { onClick: service.onPreviewDashboard, variant: "secondary", title: "Open support snapshot dashboard in a new tab" }, "Preview"))),
            React.createElement(AutoSizer, { disableWidth: true }, ({ height }) => (React.createElement("div", { style: { height, overflow: 'auto' } }, scene && React.createElement(scene.Component, { model: scene }))))))));
}
const getStyles = (theme) => ({
    code: css `
    flex-grow: 1;
    height: 100%;
    overflow: scroll;
  `,
    field: css `
    width: 100%;
  `,
    opts: css `
    display: flex;
    display: flex;
    width: 100%;
    flex-grow: 0;
    align-items: center;
    justify-content: flex-end;

    button {
      margin-left: 8px;
    }
  `,
});
//# sourceMappingURL=HelpWizard.js.map