import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drives the scripted stage timeline for the popover (ghost → solid flow).
 * Advances one stage every `intervalMs` up to the last stage, then stops.
 * `autoPlay` starts the timeline on mount (mid-query journey opens already
 * animating; the scratch journey waits for the user to submit their prompt).
 */
export function useBuildingAnimation(stageCount: number, intervalMs = 1100, autoPlay = false) {
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const stop = useCallback(() => {
    clearInterval(timer.current);
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    clearInterval(timer.current);
    setPlaying(true);
    timer.current = setInterval(() => {
      setStage((s) => {
        if (s >= stageCount - 1) {
          clearInterval(timer.current);
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, intervalMs);
  }, [stageCount, intervalMs]);

  useEffect(() => {
    if (autoPlay) {
      play();
    }
    return () => clearInterval(timer.current);
  }, [autoPlay, play]);

  return { stage, playing, play, stop };
}
