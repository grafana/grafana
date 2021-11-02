/**
 * Adds common text control options to a visualization options
 * @param builder
 * @param withTitle
 * @public
 */
export function addTextSizeOptions(builder, withTitle) {
    if (withTitle === void 0) { withTitle = true; }
    if (withTitle) {
        builder.addNumberInput({
            path: 'text.titleSize',
            category: ['Text size'],
            name: 'Title',
            settings: {
                placeholder: 'Auto',
                integer: false,
                min: 1,
                max: 200,
            },
            defaultValue: undefined,
        });
    }
    builder.addNumberInput({
        path: 'text.valueSize',
        category: ['Text size'],
        name: 'Value',
        settings: {
            placeholder: 'Auto',
            integer: false,
            min: 1,
            max: 200,
        },
        defaultValue: undefined,
    });
}
//# sourceMappingURL=text.js.map