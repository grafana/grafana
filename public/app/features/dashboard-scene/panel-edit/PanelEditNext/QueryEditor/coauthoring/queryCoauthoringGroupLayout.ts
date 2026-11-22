export interface QueryCoauthoringGroupLayout {
  left: number;
  top: number;
  width: number;
}

interface GroupBounds {
  width: number;
  height: number;
  groupHeight: number;
}

interface GroupGesture {
  kind: 'drag' | 'resize-left' | 'resize-right';
  pointerId: number;
  x: number;
  y: number;
  initial: QueryCoauthoringGroupLayout;
}

export interface QueryCoauthoringGroupState {
  groupLayout?: QueryCoauthoringGroupLayout;
  groupGesture?: GroupGesture;
  groupDragged?: boolean;
  groupResized?: boolean;
  groupAdjustmentReported?: boolean;
}

export type QueryCoauthoringGroupEvent =
  | { type: 'group-layout-frozen'; layout: QueryCoauthoringGroupLayout; bounds: GroupBounds }
  | {
      type: 'group-pointer-started';
      gesture: Omit<GroupGesture, 'initial'>;
      layout: QueryCoauthoringGroupLayout;
      bounds: GroupBounds;
    }
  | { type: 'group-pointer-moved'; pointerId: number; x: number; y: number; bounds: GroupBounds }
  | { type: 'group-pointer-ended' }
  | { type: 'group-viewport-changed'; bounds: GroupBounds }
  | { type: 'group-adjustment-reported' };

const MARGIN = 8;
const MIN_WIDTH = 200;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function constrain(layout: QueryCoauthoringGroupLayout, bounds: GroupBounds): QueryCoauthoringGroupLayout {
  const maximumWidth = Math.max(bounds.width - MARGIN * 2, 0);
  const width = clamp(layout.width, Math.min(MIN_WIDTH, maximumWidth), maximumWidth);
  return {
    width,
    left: clamp(layout.left, MARGIN, bounds.width - width - MARGIN),
    top: clamp(layout.top, MARGIN, bounds.height - bounds.groupHeight - MARGIN),
  };
}

export function reduceQueryCoauthoringGroup<T extends QueryCoauthoringGroupState>(
  state: T,
  event: QueryCoauthoringGroupEvent
): T {
  switch (event.type) {
    case 'group-layout-frozen':
      return state.groupLayout ? state : { ...state, groupLayout: constrain(event.layout, event.bounds) };
    case 'group-pointer-started': {
      const layout = state.groupLayout ?? constrain(event.layout, event.bounds);
      return { ...state, groupLayout: layout, groupGesture: { ...event.gesture, initial: layout } };
    }
    case 'group-pointer-moved': {
      const gesture = state.groupGesture;
      if (!gesture || gesture.pointerId !== event.pointerId) {
        return state;
      }
      const dx = event.x - gesture.x;
      const dy = event.y - gesture.y;
      const initial = gesture.initial;
      let layout: QueryCoauthoringGroupLayout;
      if (gesture.kind === 'drag') {
        layout = constrain({ ...initial, left: initial.left + dx, top: initial.top + dy }, event.bounds);
      } else {
        const right = initial.left + initial.width;
        const maximumWidth = Math.max(
          gesture.kind === 'resize-left' ? right - MARGIN : event.bounds.width - initial.left - MARGIN,
          0
        );
        const width = clamp(
          initial.width + (gesture.kind === 'resize-left' ? -dx : dx),
          Math.min(MIN_WIDTH, maximumWidth),
          maximumWidth
        );
        layout = { ...initial, width, left: gesture.kind === 'resize-left' ? right - width : initial.left };
      }
      const changed = layout.left !== initial.left || layout.top !== initial.top || layout.width !== initial.width;
      return {
        ...state,
        groupLayout: layout,
        groupDragged: state.groupDragged || (changed && gesture.kind === 'drag'),
        groupResized: state.groupResized || (changed && gesture.kind !== 'drag'),
      };
    }
    case 'group-pointer-ended':
      return state.groupGesture ? { ...state, groupGesture: undefined } : state;
    case 'group-viewport-changed':
      return state.groupLayout ? { ...state, groupLayout: constrain(state.groupLayout, event.bounds) } : state;
    case 'group-adjustment-reported':
      return { ...state, groupAdjustmentReported: true };
  }
}
