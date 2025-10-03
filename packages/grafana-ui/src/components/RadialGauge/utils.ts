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
