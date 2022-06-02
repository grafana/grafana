import {
  // getValueFormat,
  DataFrame,
  // ThresholdsMode
} from '@grafana/data';

export function nullToFormattedValue(frame: DataFrame) {
  frame.fields.forEach((f) => {
    const noValue = +f.config?.noValue!;
    // const disp = getValueFormat(
    //   f.config.thresholds?.mode === ThresholdsMode.Percentage ? 'percent' : f.config.unit ?? ''
    // );

    if (!Number.isNaN(noValue)) {
      const values = f.values.toArray();
      for (let i = 0; i < values.length; i++) {
        if (values[i] === null) {
          values[i] = '< '; // TODO: Update color mapping to be value and not label dependent
        }
      }
    }
  });

  return frame;
}
