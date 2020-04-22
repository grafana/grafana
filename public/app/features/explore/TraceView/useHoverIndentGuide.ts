import { useCallback, useState } from 'react';

/**
 * This is used internally to handle hover state of indent guide. As indent guides are separate
 * components per each row/span and you need to highlight all in multiple rows to make the effect of single line
 * they need this kind of common imperative state changes.
 *
 * Ideally would be changed to trace view internal state.
 */
export function useHoverIndentGuide() {
  const [hoverIndentGuideIds, setHoverIndentGuideIds] = useState(new Set<string>());

  const addHoverIndentGuideId = useCallback(function addHoverIndentGuideId(spanID: string) {
    setHoverIndentGuideIds(prevState => {
      const newHoverIndentGuideIds = new Set(prevState);
      newHoverIndentGuideIds.add(spanID);
      return newHoverIndentGuideIds;
    });
  }, []);

  const removeHoverIndentGuideId = useCallback(function removeHoverIndentGuideId(spanID: string) {
    setHoverIndentGuideIds(prevState => {
      const newHoverIndentGuideIds = new Set(prevState);
      newHoverIndentGuideIds.delete(spanID);
      return newHoverIndentGuideIds;
    });
  }, []);

  return { hoverIndentGuideIds, addHoverIndentGuideId, removeHoverIndentGuideId };
}
