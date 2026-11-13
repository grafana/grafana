import { createContext, useContext } from 'react';

import { DEFAULT_VIZ_TOOLTIP_SIZE, type VizTooltipSize } from './types';

/**
 * Carries the tooltip's {@link VizTooltipSize} down to descendant rows so their layout can react to
 * the chosen size without every consumer having to thread the prop through each row.
 * @internal
 */
export const VizTooltipContext = createContext<VizTooltipSize>(DEFAULT_VIZ_TOOLTIP_SIZE);

/** @internal */
export const useVizTooltipSize = () => useContext(VizTooltipContext);
