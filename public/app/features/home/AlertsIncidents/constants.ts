// Both home-page cards cap their scrollable list at the same height so they line up side by side.
// Raw pixels rather than a theme.spacing token because this is a layout dimension, not a spacing gap.
export const CARD_LIST_MAX_HEIGHT = 176;

// Max rows each card renders; the count/severity badges still reflect the true total and the footer
// links to the full list. Shared so the alerts and incidents cards stay symmetric.
export const HOME_CARD_MAX_ITEMS = 50;
