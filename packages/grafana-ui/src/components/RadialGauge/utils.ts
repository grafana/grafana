import { FieldDisplay } from '@grafana/data';

export function getValueAngleForValue(fieldDisplay: FieldDisplay, startAngle: number, endAngle: number) {
  const angleRange = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;
  const min = fieldDisplay.field.min ?? 0;
  const max = fieldDisplay.field.max ?? 100;

  let angle = ((fieldDisplay.display.numeric - min) / (max - min)) * angleRange;

  if (angle > angleRange) {
    angle = angleRange;
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

export interface GaugeDimensions {
  margin: number;
  radius: number;
  centerX: number;
  centerY: number;
  barWidth: number;
  endAngle?: number;
  barIndex: number;
  thresholdsBarWidth: number;
  thresholdsBarSpacing: number;
  showScaleLabels?: boolean;
}

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
): GaugeDimensions {
  const yMaxAngle = endAngle > 180 ? 180 : endAngle;
  let margin = 0;

  // Max radius based on width
  let maxRadiusH = width / 2 - margin;

  // Max radius based on height
  let heightRatioV = Math.sin(toRad(yMaxAngle));
  let maxRadiusV = (height - margin * 2) / (1 + heightRatioV);

  let maxRadius = Math.min(maxRadiusH, maxRadiusV);

  const barWidth = Math.max(barWidthFactor * (maxRadius / 3), 2);
  const thresholdsToBarWidth = 0.2 * Math.pow(barWidth, 0.92);
  const thresholdsBarWidth = thresholdBar ? Math.min(Math.max(thresholdsToBarWidth, 4), 12) : 0;
  const thresholdsBarSpacing = Math.min(Math.max(thresholdsBarWidth / 2, 2), 12);

  let outerRadius = maxRadius;

  // If rounded bars is enabled they need a bit more vertical space
  if (yMaxAngle < 180 && roundedBars) {
    outerRadius -= barWidth;
  }

  if (thresholdsBarWidth > 0) {
    maxRadiusH -= thresholdsBarWidth + thresholdsBarSpacing;
    maxRadiusV -= thresholdsBarWidth + thresholdsBarSpacing;
    outerRadius = Math.min(maxRadiusH, maxRadiusV);
  }

  if (showScaleLabels) {
    outerRadius -= 30;
  }

  if (glow) {
    margin = 0.04 * outerRadius;
    outerRadius -= (margin * 2) / (1 + heightRatioV);
  }

  let innerRadius = outerRadius - barWidth / 2;

  const maxY = maxRadius * Math.sin(toRad(yMaxAngle)) + maxRadius;
  const rest = height - maxY - margin * 2;
  const centerX = width / 2;
  const centerY = maxRadius + margin + rest / 2;

  if (barIndex > 0) {
    innerRadius = innerRadius - (barWidth + 4) * barIndex;
  }

  return {
    margin,
    radius: innerRadius,
    centerX,
    centerY,
    barWidth,
    barIndex,
    thresholdsBarWidth,
    thresholdsBarSpacing,
  };
}

export function toCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  let radian = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(radian),
    y: centerY + radius * Math.sin(radian),
  };
}
