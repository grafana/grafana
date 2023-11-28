import { useEffect } from 'react';
export function useMediaQueryChange({ breakpoint, onChange, }) {
    useEffect(() => {
        const mediaQuery = window.matchMedia(`(min-width: ${breakpoint}px)`);
        const onMediaQueryChange = (e) => onChange(e);
        mediaQuery.addEventListener('change', onMediaQueryChange);
        return () => mediaQuery.removeEventListener('change', onMediaQueryChange);
    }, [breakpoint, onChange]);
}
//# sourceMappingURL=useMediaQueryChange.js.map