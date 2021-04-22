import { useState, useCallback, useRef, useEffect } from 'react';

export function useDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement>(null);

  const openDropdown = useCallback(() => setIsOpen(true), []);
  const closeDropdown = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleGlobalMouseDown = ({ target }: MouseEvent) => {
      if (!dropdownRef.current || dropdownRef.current.contains(target as Node)) {
        return;
      }

      closeDropdown();
    };

    const handleGlobalKeydown = (evt: KeyboardEvent) => {
      if (evt.keyCode === 27) {
      }
    };

    document.addEventListener('mousedown', handleGlobalMouseDown);
    document.addEventListener('keydown', handleGlobalKeydown);

    return () => {
      document.removeEventListener('mousedown', handleGlobalMouseDown);
      document.removeEventListener('keydown', handleGlobalKeydown);
    };
  }, [closeDropdown]);

  return [dropdownRef, triggerRef, isOpen, openDropdown, closeDropdown];
}
