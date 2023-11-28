import React, { useEffect, useRef } from 'react';
import { useContentOutlineContext } from './ContentOutlineContext';
export function ContentOutlineItem({ title, icon, children, className }) {
    const { register, unregister } = useContentOutlineContext();
    const ref = useRef(null);
    useEffect(() => {
        // When the component mounts, register it and get its unique ID.
        const id = register({ title: title, icon: icon, ref: ref.current });
        // When the component unmounts, unregister it using its unique ID.
        return () => unregister(id);
    }, [title, icon, register, unregister]);
    return (React.createElement("div", { className: className, ref: ref }, children));
}
//# sourceMappingURL=ContentOutlineItem.js.map