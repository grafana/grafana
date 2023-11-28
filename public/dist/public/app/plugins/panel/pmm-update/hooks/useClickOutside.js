import { useEffect } from 'react';
export const useClickOutside = (ref, handler) => {
    useEffect(() => {
        const handleClick = (e) => {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            if (ref.current && !ref.current.contains(e.target)) {
                handler(e);
            }
        };
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                handler(e);
            }
        };
        document.addEventListener('click', handleClick);
        document.addEventListener('keydown', handleKeydown);
        return () => {
            document.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleKeydown);
        };
    }, [ref, handler]);
};
//# sourceMappingURL=useClickOutside.js.map