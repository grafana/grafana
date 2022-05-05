export const calculateTooltipPosition = (
  xPos = 0,
  yPos = 0,
  tooltipWidth = 0,
  tooltipHeight = 0,
  xOffset = 0,
  yOffset = 0,
  windowWidth = 0,
  windowHeight = 0
) => {
  let x = xPos;
  let y = yPos;

  const overflowRight = Math.max(xPos + xOffset + tooltipWidth - (windowWidth - xOffset), 0);
  const overflowLeft = Math.abs(Math.min(xPos - xOffset - tooltipWidth - xOffset, 0));
  const wouldOverflowRight = overflowRight > 0;
  const wouldOverflowLeft = overflowLeft > 0;

  const overflowBelow = Math.max(yPos + yOffset + tooltipHeight - (windowHeight - yOffset), 0);
  const overflowAbove = Math.abs(Math.min(yPos - yOffset - tooltipHeight - yOffset, 0));
  const wouldOverflowBelow = overflowBelow > 0;
  const wouldOverflowAbove = overflowAbove > 0;

  if (wouldOverflowRight && wouldOverflowLeft) {
    x = overflowRight > overflowLeft ? xOffset : windowWidth - xOffset - tooltipWidth;
  } else if (wouldOverflowRight) {
    x = xPos - xOffset - tooltipWidth;
  } else {
    x = xPos + xOffset;
  }

  if (wouldOverflowBelow && wouldOverflowAbove) {
    y = overflowBelow > overflowAbove ? yOffset : windowHeight - yOffset - tooltipHeight;
  } else if (wouldOverflowBelow) {
    y = yPos - yOffset - tooltipHeight;
  } else {
    y = yPos + yOffset;
  }
  return { x, y };
};
