import { useRef } from 'react';
import { uniqueId } from 'lodash';
export function useUniqueId() {
    // we need to lazy-init this ref.
    // otherwise we would call `uniqueId`
    // on every render. unfortunately
    // useRef does not have lazy-init builtin,
    // like useState does. we do it manually.
    var idRefLazy = useRef(null);
    if (idRefLazy.current == null) {
        idRefLazy.current = uniqueId();
    }
    return idRefLazy.current;
}
//# sourceMappingURL=useUniqueId.js.map