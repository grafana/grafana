import { useRef, useEffect } from 'react';
export var useRefMounted = function () {
    var refMounted = useRef(false);
    useEffect(function () {
        refMounted.current = true;
        return function () {
            refMounted.current = false;
        };
    });
    return refMounted;
};
//# sourceMappingURL=useRefMounted.js.map