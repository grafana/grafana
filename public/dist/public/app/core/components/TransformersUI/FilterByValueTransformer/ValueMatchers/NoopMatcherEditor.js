import { ValueMatcherID } from '@grafana/data';
export var NoopMatcherEditor = function () {
    return null;
};
export var getNoopValueMatchersUI = function () {
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