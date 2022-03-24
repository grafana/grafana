import { createContext, HTMLAttributes, useContext } from 'react';

export interface NavBarItemMenuContextProps {
  menuHasFocus: boolean;
  onClose: () => void;
  onLeft: () => void;
  menuProps?: HTMLAttributes<HTMLElement>;
}

export const NavBarItemMenuContext = createContext<NavBarItemMenuContextProps>({
  menuHasFocus: false,
  onClose: () => undefined,
  onLeft: () => undefined,
});

export function useNavBarItemMenuContext(): NavBarItemMenuContextProps {
  return useContext(NavBarItemMenuContext);
}

export interface NavBarContextProps {
  menuIdOpen: string | null;
  setMenuIdOpen: (id: string | null) => void;
}

export const NavBarContext = createContext<NavBarContextProps>({
  menuIdOpen: null,
  setMenuIdOpen: () => undefined,
});

export function useNavBarContext(): NavBarContextProps {
  return useContext(NavBarContext);
}
