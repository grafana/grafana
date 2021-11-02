export var tokenizer = {
    key: {
        pattern: /[^\s]+(?==)/,
        alias: 'attr-name',
    },
    operator: /[=]/,
    value: [
        {
            pattern: /"(.+)"/,
        },
        {
            pattern: /[^\s]+/,
        },
    ],
};
//# sourceMappingURL=syntax.js.map