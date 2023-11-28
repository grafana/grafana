import React, { useId, useRef, useState } from 'react';
import { useEffectOnce } from 'react-use';
export function LazyLoader({ children, width, height, onLoad, onChange }) {
    const id = useId();
    const [loaded, setLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const wrapperRef = useRef(null);
    useEffectOnce(() => {
        LazyLoader.addCallback(id, (entry) => {
            if (!loaded && entry.isIntersecting) {
                setLoaded(true);
                onLoad === null || onLoad === void 0 ? void 0 : onLoad();
            }
            setIsInView(entry.isIntersecting);
            onChange === null || onChange === void 0 ? void 0 : onChange(entry.isIntersecting);
        });
        const wrapperEl = wrapperRef.current;
        if (wrapperEl) {
            LazyLoader.observer.observe(wrapperEl);
        }
        return () => {
            delete LazyLoader.callbacks[id];
            wrapperEl && LazyLoader.observer.unobserve(wrapperEl);
            if (Object.keys(LazyLoader.callbacks).length === 0) {
                LazyLoader.observer.disconnect();
            }
        };
    });
    return (React.createElement("div", { id: id, ref: wrapperRef, style: { width, height } }, loaded && (typeof children === 'function' ? children({ isInView }) : children)));
}
const callbacks = {};
LazyLoader.callbacks = callbacks;
LazyLoader.addCallback = (id, c) => (LazyLoader.callbacks[id] = c);
LazyLoader.observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (LazyLoader.callbacks[entry.target.id]) {
            LazyLoader.callbacks[entry.target.id](entry);
        }
    }
}, { rootMargin: '100px' });
//# sourceMappingURL=LazyLoader.js.map