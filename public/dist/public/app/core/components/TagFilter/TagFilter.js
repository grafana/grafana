import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { components } from 'react-select';
import { escapeStringForRegex } from '@grafana/data';
import { Icon, MultiSelect, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { TagBadge } from './TagBadge';
import { TagOption } from './TagOption';
const filterOption = (option, searchQuery) => {
    const regex = RegExp(escapeStringForRegex(searchQuery), 'i');
    return regex.test(option.value);
};
export const TagFilter = ({ allowCustomValue = false, formatCreateLabel, hideValues, inputId, isClearable, onChange, placeholder, tagOptions, tags, width, }) => {
    const styles = useStyles2(getStyles);
    const currentlySelectedTags = tags.map((tag) => ({ value: tag, label: tag, count: 0 }));
    const [options, setOptions] = useState(currentlySelectedTags);
    const [isLoading, setIsLoading] = useState(false);
    const [previousTags, setPreviousTags] = useState(tags);
    const [customTags, setCustomTags] = useState(currentlySelectedTags);
    // Necessary to force re-render to keep tag options up to date / relevant
    const selectKey = useMemo(() => tags.join(), [tags]);
    const onLoadOptions = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        const options = yield tagOptions();
        return options.map((option) => {
            if (tags.includes(option.term)) {
                return {
                    value: option.term,
                    label: option.term,
                    count: 0,
                };
            }
            else {
                return {
                    value: option.term,
                    label: option.term,
                    count: option.count,
                };
            }
        });
    }), [tagOptions, tags]);
    const onFocus = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        setIsLoading(true);
        const results = yield onLoadOptions();
        if (allowCustomValue) {
            customTags.forEach((customTag) => results.push(customTag));
        }
        setOptions(results);
        setIsLoading(false);
    }), [allowCustomValue, customTags, onLoadOptions]);
    useEffect(() => {
        // Load options when tag is selected externally
        if (tags.length > 0 && options.length === 0) {
            onFocus();
        }
    }, [onFocus, options.length, tags.length]);
    useEffect(() => {
        // Update selected tags to not include (counts) when selected externally
        if (tags !== previousTags) {
            setPreviousTags(tags);
            onFocus();
        }
    }, [onFocus, previousTags, tags]);
    const onTagChange = (newTags) => {
        newTags.forEach((tag) => (tag.count = 0));
        // On remove with 1 item returns null, so we need to make sure it's an empty array in that case
        // https://github.com/JedWatson/react-select/issues/3632
        onChange((newTags || []).map((tag) => tag.value));
        // If custom values are allowed, set custom tags to prevent overwriting from query update
        if (allowCustomValue) {
            setCustomTags(newTags.filter((tag) => !tags.includes(tag)));
        }
    };
    const selectOptions = {
        key: selectKey,
        onFocus,
        isLoading,
        options,
        allowCreateWhileLoading: true,
        allowCustomValue,
        formatCreateLabel,
        defaultOptions: true,
        filterOption,
        getOptionLabel: (i) => i.label,
        getOptionValue: (i) => i.value,
        inputId,
        isMulti: true,
        onChange: onTagChange,
        loadingMessage: t('tag-filter.loading', 'Loading...'),
        noOptionsMessage: t('tag-filter.no-tags', 'No tags found'),
        placeholder: placeholder || t('tag-filter.placeholder', 'Filter by tag'),
        value: currentlySelectedTags,
        width,
        components: {
            Option: TagOption,
            MultiValueLabel: () => {
                return null; // We want the whole tag to be clickable so we use MultiValueRemove instead
            },
            MultiValueRemove(props) {
                const { data } = props;
                return (React.createElement(components.MultiValueRemove, Object.assign({}, props),
                    React.createElement(TagBadge, { key: data.label, label: data.label, removeIcon: true, count: data.count })));
            },
            MultiValueContainer: hideValues ? () => null : components.MultiValueContainer,
        },
    };
    return (React.createElement("div", { className: styles.tagFilter },
        isClearable && tags.length > 0 && (React.createElement("button", { className: styles.clear, onClick: () => onTagChange([]) }, "Clear tags")),
        React.createElement(MultiSelect, Object.assign({}, selectOptions, { prefix: React.createElement(Icon, { name: "tag-alt" }), "aria-label": "Tag filter" }))));
};
TagFilter.displayName = 'TagFilter';
const getStyles = (theme) => ({
    tagFilter: css `
    position: relative;
    min-width: 180px;
    flex-grow: 1;

    .label-tag {
      margin-left: 6px;
      cursor: pointer;
    }
  `,
    clear: css `
    background: none;
    border: none;
    text-decoration: underline;
    font-size: 12px;
    padding: none;
    position: absolute;
    top: -17px;
    right: 0;
    cursor: pointer;
    color: ${theme.colors.text.secondary};

    &:hover {
      color: ${theme.colors.text.primary};
    }
  `,
});
//# sourceMappingURL=TagFilter.js.map