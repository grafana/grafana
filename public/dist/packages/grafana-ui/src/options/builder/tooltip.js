export function addTooltipOptions(builder, singleOnly) {
    if (singleOnly === void 0) { singleOnly = false; }
    var options = singleOnly
        ? [
            { value: 'single', label: 'Single' },
            { value: 'none', label: 'Hidden' },
        ]
        : [
            { value: 'single', label: 'Single' },
            { value: 'multi', label: 'All' },
            { value: 'none', label: 'Hidden' },
        ];
    builder.addRadio({
        path: 'tooltip.mode',
        name: 'Tooltip mode',
        category: ['Tooltip'],
        description: '',
        defaultValue: 'single',
        settings: {
            options: options,
        },
    });
}
//# sourceMappingURL=tooltip.js.map