export var calculateTooltipPosition = function (xPos, yPos, tooltipWidth, tooltipHeight, xOffset, yOffset, windowWidth, windowHeight) {
    if (xPos === void 0) { xPos = 0; }
    if (yPos === void 0) { yPos = 0; }
    if (tooltipWidth === void 0) { tooltipWidth = 0; }
    if (tooltipHeight === void 0) { tooltipHeight = 0; }
    if (xOffset === void 0) { xOffset = 0; }
    if (yOffset === void 0) { yOffset = 0; }
    if (windowWidth === void 0) { windowWidth = 0; }
    if (windowHeight === void 0) { windowHeight = 0; }
    var x = xPos;
    var y = yPos;
    var overflowRight = Math.max(xPos + xOffset + tooltipWidth - (windowWidth - xOffset), 0);
    var overflowLeft = Math.abs(Math.min(xPos - xOffset - tooltipWidth - xOffset, 0));
    var wouldOverflowRight = overflowRight > 0;
    var wouldOverflowLeft = overflowLeft > 0;
    var overflowBelow = Math.max(yPos + yOffset + tooltipHeight - (windowHeight - yOffset), 0);
    var overflowAbove = Math.abs(Math.min(yPos - yOffset - tooltipHeight - yOffset, 0));
    var wouldOverflowBelow = overflowBelow > 0;
    var wouldOverflowAbove = overflowAbove > 0;
    if (wouldOverflowRight && wouldOverflowLeft) {
        x = overflowRight > overflowLeft ? xOffset : windowWidth - xOffset - tooltipWidth;
    }
    else if (wouldOverflowRight) {
        x = xPos - xOffset - tooltipWidth;
    }
    else {
        x = xPos + xOffset;
    }
    if (wouldOverflowBelow && wouldOverflowAbove) {
        y = overflowBelow > overflowAbove ? yOffset : windowHeight - yOffset - tooltipHeight;
    }
    else if (wouldOverflowBelow) {
        y = yPos - yOffset - tooltipHeight;
    }
    else {
        y = yPos + yOffset;
    }
    return { x: x, y: y };
};
//# sourceMappingURL=utils.js.map