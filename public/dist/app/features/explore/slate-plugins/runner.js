export default function RunnerPlugin(_a) {
    var handler = _a.handler;
    return {
        onKeyDown: function (event) {
            // Handle enter
            if (handler && event.key === 'Enter' && !event.shiftKey) {
                // Submit on Enter
                event.preventDefault();
                handler(event);
                return true;
            }
            return undefined;
        },
    };
}
//# sourceMappingURL=runner.js.map