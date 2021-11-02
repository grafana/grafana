import React from 'react';
export function useCombinedRefs() {
    var refs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        refs[_i] = arguments[_i];
    }
    var targetRef = React.useRef(null);
    React.useEffect(function () {
        refs.forEach(function (ref) {
            if (!ref) {
                return;
            }
            if (typeof ref === 'function') {
                ref(targetRef.current);
            }
            else {
                ref.current = targetRef.current;
            }
        });
    }, [refs]);
    return targetRef;
}
//# sourceMappingURL=useCombinedRefs.js.map