import { calculateTooltipPosition } from './utils';

describe('utils', () => {
  describe('calculateTooltipPosition', () => {
    // let's pick some easy numbers for these, we shouldn't need to change them
    const tooltipWidth = 100;
    const tooltipHeight = 100;
    const xOffset = 10;
    const yOffset = 10;
    const windowWidth = 200;
    const windowHeight = 200;

    it('sticky positions the tooltip to the right if it would overflow at both ends but overflow to the left more', () => {
      const xPos = 99;
      const yPos = 50;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 90,
        y: 60,
      });
    });

    it('sticky positions the tooltip to the left if it would overflow at both ends but overflow to the right more', () => {
      const xPos = 101;
      const yPos = 50;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 10,
        y: 60,
      });
    });

    it('positions the tooltip to left of the cursor if it would overflow right', () => {
      const xPos = 150;
      const yPos = 50;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 40,
        y: 60,
      });
    });

    it('positions the tooltip to the right of the cursor if it would not overflow', () => {
      const xPos = 50;
      const yPos = 50;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 60,
        y: 60,
      });
    });

    it('sticky positions the tooltip to the bottom if it would overflow at both ends but overflow to the top more', () => {
      const xPos = 50;
      const yPos = 99;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 60,
        y: 90,
      });
    });

    it('sticky positions the tooltip to the top if it would overflow at both ends but overflow to the bottom more', () => {
      const xPos = 50;
      const yPos = 101;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 60,
        y: 10,
      });
    });

    it('positions the tooltip above the cursor if it would overflow at the bottom', () => {
      const xPos = 50;
      const yPos = 150;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 60,
        y: 40,
      });
    });

    it('positions the tooltip below the cursor if it would not overflow', () => {
      const xPos = 50;
      const yPos = 50;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 60,
        y: 60,
      });
    });
  });
});
