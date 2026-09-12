import { cx } from '@emotion/css';
import { type ComponentProps, lazy, Suspense } from 'react';
import { type RgbaStringColorPicker as ColorfulPicker } from 'react-colorful';

import { t } from '@grafana/i18n';

import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

const LazyColorPicker = lazy(() =>
  import('react-colorful').then((module) => ({ default: module.RgbaStringColorPicker }))
);

export function RgbaStringColorPicker({
  color,
  onChange,
  onChangeEnd,
  className,
  style,
  ...rest
}: ComponentProps<typeof ColorfulPicker>) {
  return (
    <Suspense
      fallback={
        <div {...rest} className={cx('react-colorful', className)} style={{ height: 200, ...style }}>
          <LoadingPlaceholder text={t('grafana-ui.color-picker.loading', 'Loading color picker')} />
        </div>
      }
    >
      <LazyColorPicker
        {...rest}
        color={color}
        onChange={onChange}
        onChangeEnd={onChangeEnd}
        className={className}
        style={style}
      />
    </Suspense>
  );
}
