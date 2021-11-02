export function RunnerPlugin(_a) {
    var handler = _a.handler;
    return {
        onKeyDown: function (event, editor, next) {
            var keyEvent = event;
            // Handle enter
            if (handler && keyEvent.key === 'Enter' && (keyEvent.shiftKey || keyEvent.ctrlKey)) {
                // Submit on Enter
                keyEvent.preventDefault();
                handler(keyEvent);
                return editor;
            }
            return next();
        },
    };
}
//# sourceMappingURL=runner.js.map