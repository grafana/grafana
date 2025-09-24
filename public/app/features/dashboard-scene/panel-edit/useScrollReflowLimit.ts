import { useMedia } from 'react-use';

/**
 * Media query body "(max-height: 540px)" which matches screens small enough we have zoom reflow
 * problems.
 * 540px is one of the round screen size numbers that's about what we want.
 */
export const scrollReflowMediaCondition = '(max-height: 540px)';

/**
 * @returns {boolean} true when the screen is small enough to need zoom reflow handling
 */
export function useScrollReflowLimit(): boolean {
  return useMedia(scrollReflowMediaCondition);
}
