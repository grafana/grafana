/** Marks the element of a rows list that rows can be dropped into */
export const LIST_DROP_KEY_ATTR = 'data-dashboard-list-drop-key';
/**
 * Marks the element of a row inside its list. Repeated copies of a row carry the key of the row they
 * repeat, so a row and its copies count as one item when working out where a drop goes.
 */
export const LIST_ITEM_KEY_ATTR = 'data-dashboard-list-item-key';
/** Set on tab headers by the tab renderer; hovering one while dragging opens that tab */
export const TAB_ACTIVATION_KEY_ATTR = 'data-tab-activation-key';
