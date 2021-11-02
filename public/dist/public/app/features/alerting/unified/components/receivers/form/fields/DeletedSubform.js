import React, { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
// we can't drop the deleted item from list entirely because
// there will be a rece condition with register/unregister calls in react-hook-form
// and fields will become randomly erroneously unregistered
export function DeletedSubForm(_a) {
    var pathPrefix = _a.pathPrefix;
    var register = useFormContext().register;
    // required to be registered or react-hook-form will randomly drop the values when it feels like it
    useEffect(function () {
        register(pathPrefix + ".__id");
        register(pathPrefix + ".__deleted");
    }, [register, pathPrefix]);
    return React.createElement(React.Fragment, null);
}
//# sourceMappingURL=DeletedSubform.js.map