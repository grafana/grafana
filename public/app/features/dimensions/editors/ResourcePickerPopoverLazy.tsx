import { type ComponentProps, lazy, Suspense } from 'react';

const LazyResourcePickerPopover = lazy(() =>
  import(/* webpackChunkName: "resource-picker-popover" */ './ResourcePickerPopover').then((module) => ({
    default: module.ResourcePickerPopover,
  }))
);

export function ResourcePickerPopover(props: ComponentProps<typeof LazyResourcePickerPopover>) {
  return (
    <Suspense fallback={null}>
      <LazyResourcePickerPopover {...props} />
    </Suspense>
  );
}
