import React, { useMemo, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Button, Field, Form, HorizontalGroup, Input, LinkButton } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { Trans, t } from 'app/core/internationalization';
import { getGrafanaSearcher } from '../search/service';
import { PlaylistTable } from './PlaylistTable';
import { usePlaylistItems } from './usePlaylistItems';
export const PlaylistForm = ({ onSubmit, playlist }) => {
    const [saving, setSaving] = useState(false);
    const { name, interval, items: propItems } = playlist;
    const tagOptions = useMemo(() => {
        return () => getGrafanaSearcher().tags({ kind: ['dashboard'] });
    }, []);
    const { items, addByUID, addByTag, deleteItem, moveItem } = usePlaylistItems(propItems);
    const doSubmit = (list) => {
        setSaving(true);
        onSubmit(Object.assign(Object.assign({}, list), { items, uid: playlist.uid }));
    };
    return (React.createElement("div", null,
        React.createElement(Form, { onSubmit: doSubmit, validateOn: 'onBlur' }, ({ register, errors }) => {
            var _a, _b;
            const isDisabled = items.length === 0 || Object.keys(errors).length > 0;
            return (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: t('playlist-edit.form.name-label', 'Name'), invalid: !!errors.name, error: (_a = errors === null || errors === void 0 ? void 0 : errors.name) === null || _a === void 0 ? void 0 : _a.message },
                    React.createElement(Input, Object.assign({ type: "text" }, register('name', { required: t('playlist-edit.form.name-required', 'Name is required') }), { placeholder: t('playlist-edit.form.name-placeholder', 'Name'), defaultValue: name, "aria-label": selectors.pages.PlaylistForm.name }))),
                React.createElement(Field, { label: t('playlist-edit.form.interval-label', 'Interval'), invalid: !!errors.interval, error: (_b = errors === null || errors === void 0 ? void 0 : errors.interval) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(Input, Object.assign({ type: "text" }, register('interval', {
                        required: t('playlist-edit.form.interval-required', 'Interval is required'),
                    }), { placeholder: t('playlist-edit.form.interval-placeholder', '5m'), defaultValue: interval !== null && interval !== void 0 ? interval : '5m', "aria-label": selectors.pages.PlaylistForm.interval }))),
                React.createElement(PlaylistTable, { items: items, deleteItem: deleteItem, moveItem: moveItem }),
                React.createElement("div", { className: "gf-form-group" },
                    React.createElement("h3", { className: "page-headering" },
                        React.createElement(Trans, { i18nKey: "playlist-edit.form.heading" }, "Add dashboards")),
                    React.createElement(Field, { label: t('playlist-edit.form.add-title-label', 'Add by title') },
                        React.createElement(DashboardPicker, { id: "dashboard-picker", onChange: addByUID, key: items.length })),
                    React.createElement(Field, { label: t('playlist-edit.form.add-tag-label', 'Add by tag') },
                        React.createElement(TagFilter, { isClearable: true, tags: [], hideValues: true, tagOptions: tagOptions, onChange: addByTag, placeholder: t('playlist-edit.form.add-tag-placeholder', 'Select a tag') }))),
                React.createElement(HorizontalGroup, null,
                    React.createElement(Button, { type: "submit", variant: "primary", disabled: isDisabled, icon: saving ? 'fa fa-spinner' : undefined },
                        React.createElement(Trans, { i18nKey: "playlist-edit.form.save" }, "Save")),
                    React.createElement(LinkButton, { variant: "secondary", href: `${config.appSubUrl}/playlists` },
                        React.createElement(Trans, { i18nKey: "playlist-edit.form.cancel" }, "Cancel")))));
        })));
};
//# sourceMappingURL=PlaylistForm.js.map