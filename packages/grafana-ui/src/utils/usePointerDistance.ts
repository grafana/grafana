import React, { useCallback, useMemo } from 'react';

interface Point {
  x: number;
  y: number;
}
type PointerOrMouseEvent = React.PointerEvent | React.MouseEvent | PointerEvent | MouseEvent;
type PointerDistanceSet = (evt: PointerOrMouseEvent) => void;
type PointerDistanceCheck = (evt: PointerOrMouseEvent, distance?: number) => boolean;

interface PointerDistance {
  set: PointerDistanceSet;
  check: PointerDistanceCheck;
}

export function createPointerDistance(distance = 10): PointerDistance {
  let initial = { x: 0, y: 0 };

  const set: PointerDistanceSet = (evt) => {
    initial = getPoint(evt);
  };

  const check: PointerDistanceCheck = (evt, overrideDistance = distance) =>
    checkDistance(initial, getPoint(evt), overrideDistance);

  return { set, check };
}

export function usePointerDistance(distance = 10): PointerDistance {
  const initial = React.useRef<Point>({ x: 0, y: 0 });

  const set = useCallback<PointerDistance['set']>((evt) => {
    initial.current = getPoint(evt);
  }, []);

  const check = useCallback<PointerDistance['check']>(
    (evt, overrideDistance = distance) => checkDistance(initial.current, getPoint(evt), overrideDistance),
    [distance]
  );

  return useMemo(() => ({ set, check }), [set, check]);
}

function getPoint(evt: PointerOrMouseEvent): Point {
  return { x: evt.clientX, y: evt.clientY };
}

function checkDistance(point1: Point, point2: Point, distance: number): boolean {
  return Math.hypot(point1.x - point2.x, point1.y - point2.y) > distance;
}
