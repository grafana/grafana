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
    const { width: contentW, height: contentH } = state.rects.popper;
    const { width: triggerW } = state.rects.reference;
    const [basePlacement] = state.placement.split('-');

    const widthProp = basePlacement === 'left' ? 'left' : 'right';
    const heightProp = basePlacement === 'top' ? 'top' : 'bottom';

    state.modifiersData[name] = {
      maxWidth: contentW - overflow[widthProp] - x,
      maxHeight: contentH - overflow[heightProp] - y,
      minWidth: triggerW,
    };
  },
};

export const applyMaxSize: Modifier<'applyMaxSize', {}> = {
  name: 'applyMaxSize',
  enabled: true,
  phase: 'beforeWrite',
  requires: ['maxSize'],
  fn({ state }: ModifierArguments<{}>) {
    const { maxHeight, maxWidth, minWidth } = state.modifiersData.maxSize;

    state.styles.popper.maxHeight ??= `${maxHeight - MODAL_MARGIN}px`;
    state.styles.popper.minHeight ??= `${FLIP_THRESHOLD}px`;
    state.styles.popper.maxWidth ??= maxWidth;
    state.styles.popper.minWidth ??= minWidth;
  },
};
