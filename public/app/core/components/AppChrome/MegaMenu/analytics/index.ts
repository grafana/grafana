import { createInteractionEvent, EventProperty } from '@grafana/runtime/internal';

interface MegaMenuOpen extends EventProperty {
  state: boolean;
}

interface MegaMenuDocked extends EventProperty {
  state: boolean;
}

const reportMegaMenu = createInteractionEvent('grafana', 'mega_menu');

export const MegaMenuInteractions = {
  open: reportMegaMenu<MegaMenuOpen>('open'),
  docked: reportMegaMenu<MegaMenuDocked>('docked'),
};
