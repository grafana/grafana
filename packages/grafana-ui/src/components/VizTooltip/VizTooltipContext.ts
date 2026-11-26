import { createContext, useContext } from 'react';

import { type MenuProps } from '../Menu/Menu';

import { DEFAULT_VIZ_TOOLTIP_SIZE, type VizTooltipSize } from './types';

/**
 * Carries the tooltip's {@link VizTooltipSize} down to descendant rows so their layout can react to
 * the chosen size without every consumer having to thread the prop through each row.
 * @internal
 */
export const VizTooltipContext = createContext<VizTooltipSize>(DEFAULT_VIZ_TOOLTIP_SIZE);

/** @internal */
export const useVizTooltipSize = () => useContext(VizTooltipContext);

/** @internal */
export type TooltipMenuProps = Pick<MenuProps, 'autoFocus' | 'onOpen' | 'onClose' | 'onKeyDownCapture'>;

/** @internal */
export const VizTooltipMenuContext = createContext<{ menuProps?: TooltipMenuProps } | undefined>(undefined);
