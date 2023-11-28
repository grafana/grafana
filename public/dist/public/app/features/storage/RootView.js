import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import { Alert, Button, Card, FilterInput, HorizontalGroup, Icon, TagList, useStyles2, VerticalGroup, InlineField, } from '@grafana/ui';
import { getGrafanaStorage } from './storage';
import { StorageView } from './types';
export function RootView({ root, onPathChange }) {
    const styles = useStyles2(getStyles);
    const storage = useAsync(getGrafanaStorage().getConfig);
    const [searchQuery, setSearchQuery] = useState('');
    let base = location.pathname;
    if (!base.endsWith('/')) {
        base += '/';
    }
    const roots = useMemo(() => {
        var _a;
        let show = (_a = storage.value) !== null && _a !== void 0 ? _a : [];
        if (searchQuery === null || searchQuery === void 0 ? void 0 : searchQuery.length) {
            const lower = searchQuery.toLowerCase();
            show = show.filter((r) => {
                const v = r.config;
                const isMatch = v.name.toLowerCase().indexOf(lower) >= 0 || v.description.toLowerCase().indexOf(lower) >= 0;
                if (isMatch) {
                    return true;
                }
                return false;
            });
        }
        const base = [];
        const content = [];
        for (const r of show !== null && show !== void 0 ? show : []) {
            if (r.config.underContentRoot) {
                content.push(r);
            }
            else if (r.config.prefix !== 'content') {
                base.push(r);
            }
        }
        return { base, content };
    }, [searchQuery, storage]);
    const renderRoots = (pfix, roots) => {
        return (React.createElement(VerticalGroup, null, roots.map((s) => {
            var _a, _b, _c, _d;
            const ok = s.ready;
            return (React.createElement(Card, { key: s.config.prefix, href: ok ? `admin/storage/${pfix}${s.config.prefix}/` : undefined },
                React.createElement(Card.Heading, null, s.config.name),
                React.createElement(Card.Meta, { className: styles.clickable },
                    s.config.description,
                    ((_a = s.config.git) === null || _a === void 0 ? void 0 : _a.remote) && React.createElement("a", { href: (_b = s.config.git) === null || _b === void 0 ? void 0 : _b.remote }, (_c = s.config.git) === null || _c === void 0 ? void 0 : _c.remote)), (_d = s.notice) === null || _d === void 0 ? void 0 :
                _d.map((notice) => React.createElement(Alert, { key: notice.text, severity: notice.severity, title: notice.text })),
                React.createElement(Card.Tags, { className: styles.clickable },
                    React.createElement(HorizontalGroup, null,
                        React.createElement(TagList, { tags: getTags(s) }))),
                React.createElement(Card.Figure, { className: styles.clickable },
                    React.createElement(Icon, { name: getIconName(s.config.type), size: "xxxl", className: styles.secondaryTextColor }))));
        })));
    };
    return (React.createElement("div", null,
        React.createElement("div", { className: "page-action-bar" },
            React.createElement(InlineField, { grow: true },
                React.createElement(FilterInput, { placeholder: "Search Storage", value: searchQuery, onChange: setSearchQuery })),
            React.createElement(Button, { className: "pull-right", onClick: () => onPathChange('', StorageView.AddRoot) }, "Add Root")),
        React.createElement("div", null, renderRoots('', roots.base)),
        React.createElement("div", null,
            React.createElement("h3", null, "Content"),
            renderRoots('content/', roots.content))));
}
function getStyles(theme) {
    return {
        secondaryTextColor: css `
      color: ${theme.colors.text.secondary};
    `,
        clickable: css `
      pointer-events: none;
    `,
    };
}
function getTags(v) {
    const tags = [];
    if (v.builtin) {
        tags.push('Builtin');
    }
    // Error
    if (!v.ready) {
        tags.push('Not ready');
    }
    return tags;
}
export function getIconName(type) {
    switch (type) {
        case 'git':
            return 'code-branch';
        case 'disk':
            return 'folder-open';
        case 'sql':
            return 'database';
        default:
            return 'folder-open';
    }
}
//# sourceMappingURL=RootView.js.map