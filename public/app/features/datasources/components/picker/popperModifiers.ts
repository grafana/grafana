import { detectOverflow, Modifier, ModifierArguments } from '@popperjs/core';

const MODAL_MARGIN = 20;
const FLIP_THRESHOLD = 200;

export const maxSize: Modifier<'maxSize', {}> = {
  name: 'maxSize',
  enabled: true,
  phase: 'main',
  requires: ['offset', 'preventOverflow', 'flip'],
  fn({ state, name, options }: ModifierArguments<{}>) {
    const overflow = detectOverflow(state, options);
    const { x, y } = state.modifiersData.preventOverflow || { x: 0, y: 0 };
    const { width, height } = state.rects.popper;
    const [basePlacement] = state.placement.split('-');

    const widthProp = basePlacement === 'left' ? 'left' : 'right';
    const heightProp = basePlacement === 'top' ? 'top' : 'bottom';

    state.modifiersData[name] = {
      width: width - overflow[widthProp] - x,
      height: height - overflow[heightProp] - y,
    };
  },
};

export const applyMaxSize: Modifier<'applyMaxSize', {}> = {
  name: 'applyMaxSize',
  enabled: true,
  phase: 'beforeWrite',
  requires: ['maxSize'],
  fn({ state }: ModifierArguments<{}>) {
    const { height, width } = state.modifiersData.maxSize;

    if (!state.styles.popper.maxHeight) {
      state.styles.popper.maxHeight = `${height - MODAL_MARGIN}px`;
    }
    if (!state.styles.popper.minHeight) {
      state.styles.popper.minHeight = `${FLIP_THRESHOLD}px`;
    }

    if (!state.styles.popper.maxWidth) {
      state.styles.popper.maxWidth = width;
    }
  },
};
