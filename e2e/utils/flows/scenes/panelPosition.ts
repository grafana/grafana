import { e2e } from '../..';

export const verifyPanelsStackedVertically = () => {
  let initialOffset = 0;
  e2e.components.Panels.Panel.title('New panel').each((el) => {
    if (!initialOffset) {
      initialOffset = el.offset().top;
    } else {
      const elOffset = el.offset().top;
      expect(elOffset).to.be.greaterThan(initialOffset);
      initialOffset = elOffset;
    }
  });
};
