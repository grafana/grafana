import { FieldDisplay, getDisplayProcessor } from '@grafana/data';

import { RadialGaugeDimensions } from './types';

export function getFieldDisplayProcessor(displayValue: FieldDisplay) {
  if (displayValue.view && displayValue.colIndex != null) {
    const dp = displayValue.view.getFieldDisplayProcessor(displayValue.colIndex);
    if (dp) {
      return dp;
    }
  }

  return getDisplayProcessor();
}

export function getFieldConfigMinMax(fieldDisplay: FieldDisplay) {
  const min = fieldDisplay.field.min ?? 0;
  const max = fieldDisplay.field.max ?? 100;
  return [min, max];
}

export function getValueAngleForValue(
  fieldDisplay: FieldDisplay,
  startAngle: number,
  endAngle: number,
  value = fieldDisplay.display.numeric
) {
  const [min, max] = getFieldConfigMinMax(fieldDisplay);
  const angleRange = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;

  let angle = ((value - min) / (max - min)) * angleRange;

  if (angle > angleRange) {
    angle = angleRange;
  } else if (angle < 0) {
    angle = 0;
  }

  return { angleRange, angle };
}

/**
 * Returns the angle in radians for a given angle in degrees
 * But shifted -90 degrees to make 0 degree angle point upwards
 * @param angle
 * @returns
 */
export function toRad(angle: number) {
  return ((angle - 90) * Math.PI) / 180;
}

/**
 * returns the calculated dimensions for the radial gauge
 * @param width
 * @param height
 * @param endAngle
 * @param glow
 * @param roundedBars
 * @param barWidthFactor
 * @param barIndex
 * @param thresholdBar
 * @param showScaleLabels
 * @returns {RadialGaugeDimensions}
 */
export function calculateDimensions(
  width: number,
  height: number,
  endAngle: number,
  glow: boolean,
  roundedBars: boolean,
  barWidthFactor: number,
  barIndex: number,
  thresholdBar?: boolean,
  showScaleLabels?: boolean
): RadialGaugeDimensions {
  const yMaxAngle = endAngle > 180 ? 180 : endAngle;
  let margin = 0;

  if (glow) {
    margin = 0.02 * Math.min(width, height);
  }

  // Max radius based on width
  let maxRadiusW = width / 2 - margin;

  // Max radius based on height
  let heightRatioV = Math.sin(toRad(yMaxAngle));
  let maxRadiusH = (height - margin * 2) / (1 + heightRatioV);

  let maxRadius = Math.min(maxRadiusW, maxRadiusH);
  let maxRadiusIsLimitedByHeight = maxRadiusH === maxRadius;
  let outerRadius = maxRadius;

  const barWidth = Math.max(barWidthFactor * (maxRadius / 3), 2);

  // If rounded bars is enabled they need a bit more vertical space
  if (yMaxAngle < 180 && roundedBars) {
    outerRadius -= barWidth;
    maxRadiusH -= barWidth;
    maxRadiusW -= barWidth;
  }

  // Scale labels
  let scaleLabelsFontSize = 0;
  let scaleLabelsSpacing = 0;
  let scaleLabelsRadius = 0;

  if (showScaleLabels) {
    scaleLabelsRadius = outerRadius;
    const radiusToFontSizeFactor = 0.12;
    scaleLabelsFontSize = Math.max(radiusToFontSizeFactor * Math.pow(outerRadius, 0.92), 10);
    scaleLabelsSpacing = scaleLabelsFontSize / 3;
    const labelsSize = scaleLabelsFontSize * 1.2 + scaleLabelsSpacing;
    outerRadius -= labelsSize;
    maxRadiusW -= labelsSize;
    maxRadiusH -= labelsSize;

    // FIXME: needs coverage
    // For gauges the max label needs a bit more vertical space so that it does not get clipped
    if (maxRadiusIsLimitedByHeight && endAngle < 180) {
      const amount = outerRadius * 0.07;
      scaleLabelsRadius -= amount;
      maxRadiusH -= amount;
      maxRadiusW -= amount;
      outerRadius -= amount;
    }
  }

  // Thresholds bar
  const thresholdsToBarWidth = 0.2 * Math.pow(barWidth, 0.92);
  const thresholdsBarWidth = thresholdBar ? Math.min(Math.max(thresholdsToBarWidth, 4), 12) : 0;
  const thresholdsBarSpacing = Math.min(Math.max(thresholdsBarWidth / 2, 2), 12);
  let thresholdsBarRadius = 0;

  if (thresholdsBarWidth > 0) {
    thresholdsBarRadius = outerRadius - thresholdsBarWidth / 2;
    maxRadiusW -= thresholdsBarWidth + thresholdsBarSpacing;
    maxRadiusH -= thresholdsBarWidth + thresholdsBarSpacing;
    outerRadius = Math.min(maxRadiusW, maxRadiusH);
  }

  let innerRadius = outerRadius - barWidth / 2;

  const belowCenterY = maxRadius * Math.sin(toRad(yMaxAngle));
  const rest = height - belowCenterY - margin * 2 - maxRadius;
  const centerX = width / 2;
  const centerY = maxRadius + margin + rest / 2;

  if (barIndex > 0) {
    innerRadius = innerRadius - (barWidth + 4) * barIndex;
  }

  return {
    margin,
    gaugeBottomY: centerY + belowCenterY,
    radius: innerRadius,
    centerX,
    centerY,
    barWidth,
    barIndex,
    thresholdsBarWidth,
    thresholdsBarSpacing,
    thresholdsBarRadius,
    scaleLabelsFontSize,
    scaleLabelsSpacing,
    scaleLabelsRadius,
  };
}

export function toCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  let radian = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(radian),
    y: centerY + radius * Math.sin(radian),
  };
}

export function drawRadialArcPath(
  startAngle: number,
  endAngle: number,
  dimensions: RadialGaugeDimensions,
  roundedBars?: boolean
): string {
  const { radius, centerX, centerY, barWidth } = dimensions;

  // For some reason a 100% full arc cannot be rendered
  if (endAngle >= 360) {
    endAngle = 359.99;
  }

  const startRadians = toRad(startAngle);
  const endRadians = toRad(startAngle + endAngle);

  const largeArc = endAngle > 180 ? 1 : 0;

  const outerR = radius + barWidth / 2;
  const innerR = Math.max(0, radius - barWidth / 2);
  if (innerR <= 0) {
    return ''; // cannot draw arc with 0 inner radius
  }

  // get points for both an inner and outer arc. we draw
  // the arc entirely with a path's fill instead of using stroke
  // so that it can be used as a clip-path.
  const ox1 = centerX + outerR * Math.cos(startRadians);
  const oy1 = centerY + outerR * Math.sin(startRadians);
  const ox2 = centerX + outerR * Math.cos(endRadians);
  const oy2 = centerY + outerR * Math.sin(endRadians);

  const ix1 = centerX + innerR * Math.cos(startRadians);
  const iy1 = centerY + innerR * Math.sin(startRadians);
  const ix2 = centerX + innerR * Math.cos(endRadians);
  const iy2 = centerY + innerR * Math.sin(endRadians);

  // calculate the cap width in case we're drawing rounded bars
  const capR = barWidth / 2;

  const pathParts = [
    // start at outer start
    'M',
    ox1,
    oy1,
    // outer arc from start to end (clockwise)
    'A',
    outerR,
    outerR,
    0,
    largeArc,
    1,
    ox2,
    oy2,
  ];

  if (roundedBars) {
    // rounded end cap: small arc connecting outer end to inner end
    pathParts.push('A', capR, capR, 0, 0, 1, ix2, iy2);
  } else {
    // straight line to inner end (square butt)
    pathParts.push('L', ix2, iy2);
  }

  // inner arc from end back to start (counter-clockwise)
  pathParts.push('A', innerR, innerR, 0, largeArc, 0, ix1, iy1);

  if (roundedBars) {
    // rounded start cap: small arc connecting inner start back to outer start
    pathParts.push('A', capR, capR, 0, 0, 1, ox1, oy1);
  } else {
    // straight line back to outer start (square butt)
    pathParts.push('L', ox1, oy1);
  }

  pathParts.push('Z');

  return pathParts.join(' ');
}

export function getAngleBetweenSegments(segmentSpacing: number, segmentCount: number, range: number) {
  // Max spacing is 8 degrees between segments
  // Changing this constant could be considered a breaking change
  const maxAngleBetweenSegments = Math.max(range / 1.5 / segmentCount, 2);
  return segmentSpacing * maxAngleBetweenSegments;
}

export function getOptimalSegmentCount(
  dimensions: RadialGaugeDimensions,
  segmentSpacing: number,
  segmentCount: number,
  range: number
) {
  const angleBetweenSegments = getAngleBetweenSegments(segmentSpacing, segmentCount, range);

  const innerRadius = dimensions.radius - dimensions.barWidth / 2;
  const circumference = Math.PI * innerRadius * 2 * (range / 360);
  const maxSegments = Math.floor(circumference / (angleBetweenSegments + 3));

  return Math.min(maxSegments, segmentCount);
}
