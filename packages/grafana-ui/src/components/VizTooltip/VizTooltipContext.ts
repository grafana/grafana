import { createContext, useContext } from 'react';

import { DEFAULT_VIZ_TOOLTIP_SIZE, type VizTooltipSize } from './types';

/**
 * Carries the tooltip's {@link VizTooltipSize} down to descendant rows so their layout can react to
 * the chosen size without every consumer threading the prop through each row. Defaults to `auto` so
 * a row rendered outside a {@link VizTooltipWrapper} keeps the old-system layout.
 * @internal
 */
export const VizTooltipContext = createContext<VizTooltipSize>(DEFAULT_VIZ_TOOLTIP_SIZE);

/** @internal */
export const useVizTooltipSize = () => useContext(VizTooltipContext);
