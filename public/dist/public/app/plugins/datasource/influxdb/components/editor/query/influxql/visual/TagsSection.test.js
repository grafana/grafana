import { __awaiter } from "tslib";
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { TagsSection } from './TagsSection';
function getTagKeys() {
    return Promise.resolve(['t1', 't2', 't3', 't4', 't5', 't6']);
}
function getTagValuesForKey(key) {
    const data = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map((v) => `${key}_${v}`);
    return Promise.resolve(data);
}
function assertText(tags, textResult) {
    const { container } = render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: () => null }));
    expect(container.textContent).toBe(textResult);
}
function assertSegmentSelect(segmentText, optionText, callback, callbackValue) {
    return __awaiter(this, void 0, void 0, function* () {
        // we find the segment
        const segs = screen.getAllByRole('button', { name: segmentText });
        expect(segs.length).toBe(1);
        const seg = segs[0];
        expect(seg).toBeInTheDocument();
        act(() => {
            fireEvent.click(seg);
        });
        // find the option and click it
        const option = yield screen.findByText(optionText, { selector: 'span' });
        expect(option).toBeInTheDocument();
        act(() => {
            fireEvent.click(option);
        });
        yield waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
        expect(callback).toHaveBeenCalledWith(callbackValue);
    });
}
const tags = [
    {
        key: 't1',
        value: 't1_v1',
        operator: '=',
    },
    {
        condition: 'AND',
        key: 't2',
        value: 't2_v2',
        operator: '!=',
    },
    {
        condition: 'OR',
        key: 't3',
        value: 't3_v3',
        operator: '<>',
    },
];
describe('InfluxDB InfluxQL Editor tags section', () => {
    it('should display correct data', () => {
        assertText(tags, 't1=t1_v1ANDt2!=t2_v2ORt3<>t3_v3+');
    });
    it('should handle incorrect data', () => {
        const incorrectTags = [
            {
                condition: 'OR',
                key: 't1',
                value: 't1_v1',
                operator: '=',
            },
            {
                // missing `condition`
                key: 't2',
                value: 't2_v2',
                operator: '!=',
            },
            {
                condition: 'OR',
                key: 't3',
                value: 't3_v3',
                // missing `operator, string-value
            },
            {
                condition: 'OR',
                key: 't4',
                value: '/t4_v4/',
                // missing `operator, regex-value
            },
            {
                condition: 'XOR',
                key: 't5',
                value: 't5_v5',
                operator: 'haha', // invalid `operator`
            },
        ];
        assertText(incorrectTags, 't1=t1_v1ANDt2!=t2_v2ORt3=t3_v3ORt4=~/t4_v4/XORt5hahat5_v5+');
    });
    it('should handle adding a new tag check', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: onChange }));
        yield assertSegmentSelect('+', 't5', onChange, [
            ...tags,
            {
                key: 't5',
                value: 'select tag value',
                operator: '=',
                condition: 'AND',
            },
        ]);
    }));
    it('should handle changing the tag-condition', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: onChange }));
        const newTags = [...tags];
        newTags[1] = Object.assign(Object.assign({}, newTags[1]), { condition: 'OR' });
        yield assertSegmentSelect('AND', 'OR', onChange, newTags);
    }));
    it('should handle changing the tag-key', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: onChange }));
        const newTags = [...tags];
        newTags[1] = Object.assign(Object.assign({}, newTags[1]), { key: 't5' });
        yield assertSegmentSelect('t2', 't5', onChange, newTags);
    }));
    it('should handle changing the tag-operator', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: onChange }));
        const newTags = [...tags];
        newTags[2] = Object.assign(Object.assign({}, newTags[2]), { operator: '<' });
        yield assertSegmentSelect('<>', '<', onChange, newTags);
    }));
    it('should handle changing the tag-value', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: onChange }));
        const newTags = [...tags];
        newTags[0] = Object.assign(Object.assign({}, newTags[0]), { value: 't1_v5' });
        yield assertSegmentSelect('t1_v1', 't1_v5', onChange, newTags);
    }));
});
//# sourceMappingURL=TagsSection.test.js.map