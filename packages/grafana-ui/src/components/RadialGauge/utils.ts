import { FieldDisplay } from '@grafana/data';

export function getValueAngleForValue(fieldDisplay: FieldDisplay, startAngle: number, endAngle: number) {
  const range = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;
  const min = fieldDisplay.field.min ?? 0;
  const max = fieldDisplay.field.max ?? 100;

  let angle = ((fieldDisplay.display.numeric - min) / (max - min)) * range;

  if (angle > range) {
    angle = range;
  }

  return { range, angle };
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
}

export function calculateDimensions(
  width: number,
  height: number,
  endAngle: number,
  glow: boolean,
  spotlight: boolean,
  roundedBars: boolean,
  barWidthFactor: number
): GaugeDimensions {
  const yMaxAngle = endAngle > 180 ? 180 : endAngle;
  let margin = 0;

  // Max radius based on width
  let maxRadiusH = width / 2 - margin;

  // Max radius based on height
  let heightRatioV = Math.sin(toRad(yMaxAngle));
  let outerRadiusV = (height - margin * 2) / (1 + heightRatioV);

  let maxRadiusV = outerRadiusV;
  let outerRadius = Math.min(maxRadiusH, maxRadiusV);

  const barWidth = Math.max(barWidthFactor * (outerRadius / 3.5), 2);

  // If rounded bars is enabled they need a bit more vertical space
  if (yMaxAngle < 180 && roundedBars) {
    outerRadius -= barWidth / 4;
  }

  if (glow) {
    margin = 0.04 * outerRadius;
    outerRadius -= (margin * 2) / (1 + heightRatioV);
  }

  const innerRadius = outerRadius - barWidth / 2;
  const centerX = width / 2;
  const centerY = outerRadius + margin;

  return { margin, radius: innerRadius, centerX, centerY, barWidth };
}
