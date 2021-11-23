// import React, { useEffect } from 'react';
// import { css } from '@emotion/css';
// import { GrafanaTheme2, NavModelItem } from '@grafana/data';
// import { useTheme2 } from '@grafana/ui';
// import { DismissButton, useOverlay } from '@react-aria/overlays';
// import { FocusScope } from '@react-aria/focus';
// import { mergeProps } from '@react-aria/utils';
// import { useMenu, useMenuItem } from '@react-aria/menu';
// import { useTreeState } from '@react-stately/tree';
// import { useFocus } from '@react-aria/interactions';
//
// interface Props {
//   items?: NavModelItem[];
//   onHeaderClick?: () => void;
//   reverseDirection?: boolean;
//   enableAllItems: boolean;
// }
//
// const NavBarDropdown = ({
//   items = [],
//   onHeaderClick,
//   reverseDirection = false,
//   enableAllItems = false,
//   ...rest
// }: Props) => {
//   const theme = useTheme2();
//   const styles = getStyles(theme, reverseDirection);
//
//   const disabledKeys = [];
//   for (let index = 0; index < items.length; index++) {
//     const item = items[index];
//     if (item.id?.startsWith('divider') || !enableAllItems) {
//       const keyDom = `${item.id}-${index}`;
//       disabledKeys.push(keyDom);
//     }
//   }
//
//   // Disable all keys that are subtitle they should not be focusable
//   disabledKeys.push('subtitle');
//
//   // Create menu state based on the incoming props
//   const state = useTreeState({ ...rest, disabledKeys });
//
//   const { selectionManager, collection, ...restState } = state;
//
//   // Get props for the menu element
//   const ref = React.useRef(null);
//   const { menuProps } = useMenu(rest, { ...restState, selectionManager, collection }, ref);
//
//   // Handle events that should cause the menu to close,
//   // e.g. blur, clicking outside, or pressing the escape key.
//   const overlayRef = React.useRef(null);
//   const { overlayProps } = useOverlay(
//     {
//       onClose: rest.onClose,
//       shouldCloseOnBlur: true,
//       isOpen: true,
//       isDismissable: true,
//     },
//     overlayRef
//   );
//
//   useEffect(() => {
//     if (enableAllItems && !selectionManager.isFocused) {
//       const key = reverseDirection ? collection.getLastKey() : collection.getFirstKey();
//       selectionManager.setFocusedKey(key);
//       selectionManager.setFocused(true);
//     } else if (!enableAllItems && selectionManager.isFocused) {
//       selectionManager.setFocused(false);
//       selectionManager.clearSelection();
//     }
//   }, [enableAllItems, selectionManager, collection, reverseDirection]);
//
//   // Wrap in <FocusScope> so that focus is restored back to the
//   // trigger when the menu is closed. In addition, add hidden
//   // <DismissButton> components at the start and end of the list
//   // to allow screen reader users to dismiss the popup easily.
//   return (
//     <FocusScope restoreFocus>
//       <div {...overlayProps} ref={overlayRef}>
//         <DismissButton onDismiss={rest.onClose} />
//         <ul
//           className={`${styles.menu} navbar-dropdown`}
//           {...mergeProps(menuProps, rest.domProps)}
//           ref={ref}
//           tabIndex={enableAllItems ? 0 : -1}
//         >
//           {[...state.collection].map((item) => (
//             <MenuItem
//               key={item.key}
//               item={item}
//               state={state}
//               onAction={rest.onAction}
//               onClose={rest.onClose}
//               reverseDirection={reverseDirection}
//             />
//           ))}
//         </ul>
//
//         <DismissButton onDismiss={rest.onClose} />
//       </div>
//     </FocusScope>
//   );
// };
//
// export function MenuItem({ item, state, onAction, onClose, reverseDirection }: any) {
//   // Get props for the menu item element
//   const ref = React.useRef(null);
//
//   const { menuItemProps } = useMenuItem(
//     {
//       key: item.key,
//       onAction,
//       isDisabled: state.disabledKeys.has(item.key),
//       onClose,
//     },
//     state,
//     ref
//   );
//
//   // style to the focused menu item
//   const [isFocused, setFocused] = React.useState(false);
//   const { focusProps } = useFocus({ onFocusChange: setFocused });
//
//   const theme = useTheme2();
//
//   const styles = getStylesMenuItem(theme, isFocused, reverseDirection);
//
//   const onKeyDown = (e: React.KeyboardEvent) => {
//     switch (e.key) {
//       case 'Enter':
//       case ' ':
//         // Stop propagation, unless it would already be handled by useKeyboard.
//         if (!('continuePropagation' in e)) {
//           e.stopPropagation();
//         }
//         e.preventDefault();
//         // Alert: Hacky way to go to link
//         e.currentTarget?.querySelector('a')?.click();
//         e.currentTarget?.querySelector('button')?.click();
//         break;
//     }
//   };
//
//   return (
//     <li {...mergeProps(menuItemProps, focusProps)} onKeyDown={onKeyDown} ref={ref} className={styles.menuItem}>
//       {item.rendered}
//     </li>
//   );
// }
//
// const getStylesMenuItem = (theme: GrafanaTheme2, isFocused: boolean, reverseDirection: boolean) => ({
//   menuItem: css`
//     background-color: ${isFocused ? theme.colors.action.hover : 'transparent'};
//     color: ${isFocused ? 'white' : theme.colors.text.primary};
//
//     &:focus-visible {
//       background-color: ${theme.colors.action.hover};
//       box-shadow: none;
//       color: ${theme.colors.text.primary};
//       outline: 2px solid ${theme.colors.primary.main};
//       // Need to add condition, header is 0, otherwise -2
//       outline-offset: -0px;
//       transition: none;
//     }
//   `,
//   subtitle: css`
//       border-${reverseDirection ? 'bottom' : 'top'}: 1px solid ${theme.colors.border.weak};
//       color: ${theme.colors.text.secondary};
//       font-size: ${theme.typography.bodySmall.fontSize};
//       font-weight: ${theme.typography.bodySmall.fontWeight};
//       padding: ${theme.spacing(1)} ${theme.spacing(2)} ${theme.spacing(1)};
//       white-space: nowrap;
//     `,
// });
//
// export default NavBarDropdown;
//
// const getStyles = (theme: GrafanaTheme2, reverseDirection: Props['reverseDirection']) => {
//   return {
//     menu: css`
//       background-color: ${theme.colors.background.primary};
//       border: 1px solid ${theme.components.panel.borderColor};
//       bottom: ${reverseDirection ? 0 : 'auto'};
//       box-shadow: ${theme.shadows.z3};
//       display: flex;
//       flex-direction: column;
//       left: 100%;
//       list-style: none;
//       min-width: 140px;
//       position: absolute;
//       top: ${reverseDirection ? 'auto' : 0};
//       transition: ${theme.transitions.create('opacity')};
//       z-index: ${theme.zIndex.sidemenu};
//       list-style: none;
//     `,
//   };
// };
