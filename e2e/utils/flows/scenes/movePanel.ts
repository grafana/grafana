import { e2e } from '../..';

/** Drags and drops the panel with title `sourcePanel` to the location of the panel with title `targetPanel` */
export const movePanel = (sourcePanel: string | RegExp, targetPanel: string | RegExp) => {
  e2e.components.Panels.Panel.headerContainer()
    .contains(targetPanel)
    .then((el) => {
      const rect = el.offset();
      e2e.components.Panels.Panel.headerContainer()
        .contains(sourcePanel)
        .trigger('mousedown', { which: 1 })
        .trigger('mousemove', { clientX: rect.left, clientY: rect.top })
        .trigger('mouseup', { force: true });
    });
};
