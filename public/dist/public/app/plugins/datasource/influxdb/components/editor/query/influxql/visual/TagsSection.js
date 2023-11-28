import React from 'react';
import { AccessoryButton } from '@grafana/experimental';
import { adjustOperatorIfNeeded, getCondition, getOperator } from '../utils/tagUtils';
import { toSelectableValue } from '../utils/toSelectableValue';
import { AddButton } from './AddButton';
import { Seg } from './Seg';
const knownOperators = ['=', '!=', '<>', '<', '>', '=~', '!~'];
const knownConditions = ['AND', 'OR'];
const operatorOptions = knownOperators.map(toSelectableValue);
const condititonOptions = knownConditions.map(toSelectableValue);
const loadConditionOptions = () => Promise.resolve(condititonOptions);
const loadOperatorOptions = () => Promise.resolve(operatorOptions);
const Tag = ({ tag, isFirst, onRemove, onChange, getTagKeyOptions, getTagValueOptions }) => {
    const operator = getOperator(tag);
    const condition = getCondition(tag, isFirst);
    const getTagKeySegmentOptions = () => {
        return getTagKeyOptions()
            .catch((err) => {
            // in this UI element we add a special item to the list of options,
            // that is used to remove the element.
            // this causes a problem: if `getTagKeyOptions` fails with an error,
            // the remove-filter option is never added to the list,
            // and the UI element can not be removed.
            // to avoid it, we catch any potential errors coming from `getTagKeyOptions`,
            // log the error, and pretend that the list of options is an empty list.
            // this way the remove-item option can always be added to the list.
            console.error(err);
            return [];
        })
            .then((tags) => tags.map(toSelectableValue));
    };
    const getTagValueSegmentOptions = () => {
        return getTagValueOptions(tag.key).then((tags) => tags.map(toSelectableValue));
    };
    return (React.createElement("div", { className: "gf-form" },
        condition != null && (React.createElement(Seg, { value: condition, loadOptions: loadConditionOptions, onChange: (v) => {
                onChange(Object.assign(Object.assign({}, tag), { condition: v.value }));
            } })),
        React.createElement(Seg, { allowCustomValue: true, value: tag.key, loadOptions: getTagKeySegmentOptions, onChange: (v) => {
                const { value } = v;
                if (value === undefined) {
                    onRemove();
                }
                else {
                    onChange(Object.assign(Object.assign({}, tag), { key: value !== null && value !== void 0 ? value : '' }));
                }
            } }),
        React.createElement(Seg, { value: operator, loadOptions: loadOperatorOptions, onChange: (op) => {
                onChange(Object.assign(Object.assign({}, tag), { operator: op.value }));
            } }),
        React.createElement(Seg, { allowCustomValue: true, value: tag.value, loadOptions: getTagValueSegmentOptions, onChange: (v) => {
                var _a;
                const value = (_a = v.value) !== null && _a !== void 0 ? _a : '';
                onChange(Object.assign(Object.assign({}, tag), { value, operator: adjustOperatorIfNeeded(operator, value) }));
            } }),
        React.createElement(AccessoryButton, { style: { marginRight: '4px' }, "aria-label": "remove", icon: "times", variant: "secondary", onClick: () => {
                onRemove();
            } })));
};
export const TagsSection = ({ tags, onChange, getTagKeyOptions, getTagValueOptions }) => {
    const onTagChange = (newTag, index) => {
        const newTags = tags.map((tag, i) => {
            return index === i ? newTag : tag;
        });
        onChange(newTags);
    };
    const onTagRemove = (index) => {
        const newTags = tags.filter((t, i) => i !== index);
        onChange(newTags);
    };
    const getTagKeySegmentOptions = () => {
        return getTagKeyOptions().then((tags) => tags.map(toSelectableValue));
    };
    const addNewTag = (tagKey, isFirst) => {
        const minimalTag = {
            key: tagKey,
            value: 'select tag value',
        };
        const newTag = {
            key: minimalTag.key,
            value: minimalTag.value,
            operator: getOperator(minimalTag),
            condition: getCondition(minimalTag, isFirst),
        };
        onChange([...tags, newTag]);
    };
    return (React.createElement(React.Fragment, null,
        tags.map((t, i) => (React.createElement(Tag, { tag: t, isFirst: i === 0, key: i, onChange: (newT) => {
                onTagChange(newT, i);
            }, onRemove: () => {
                onTagRemove(i);
            }, getTagKeyOptions: getTagKeyOptions, getTagValueOptions: getTagValueOptions }))),
        React.createElement(AddButton, { allowCustomValue: true, loadOptions: getTagKeySegmentOptions, onAdd: (v) => {
                addNewTag(v, tags.length === 0);
            } })));
};
//# sourceMappingURL=TagsSection.js.map