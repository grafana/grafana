import { ValueMatcherID } from '@grafana/data';
export const NoopMatcherEditor = () => {
    return null;
};
export const getNoopValueMatchersUI = () => {
    return [
        {
            name: 'Is null',
            id: ValueMatcherID.isNull,
            component: NoopMatcherEditor,
        },
        {
            name: 'Is not null',
            id: ValueMatcherID.isNotNull,
            component: NoopMatcherEditor,
        },
    ];
};
//# sourceMappingURL=NoopMatcherEditor.js.map