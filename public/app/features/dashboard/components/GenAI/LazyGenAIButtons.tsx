import { type ComponentProps, lazy, Suspense } from 'react';

type GenAIDashDescriptionButtonProps = ComponentProps<
  typeof import('./GenAIDashDescriptionButton').GenAIDashDescriptionButton
>;
type GenAIDashTitleButtonProps = ComponentProps<typeof import('./GenAIDashTitleButton').GenAIDashTitleButton>;
type GenAIPanelDescriptionButtonProps = ComponentProps<
  typeof import('./GenAIPanelDescriptionButton').GenAIPanelDescriptionButton
>;
type GenAIPanelTitleButtonProps = ComponentProps<typeof import('./GenAIPanelTitleButton').GenAIPanelTitleButton>;

const GenAIDashDescriptionButton = lazy(() =>
  import(/* webpackChunkName: "dashboard-genai" */ './GenAIDashDescriptionButton').then((module) => ({
    default: module.GenAIDashDescriptionButton,
  }))
);
const GenAIDashTitleButton = lazy(() =>
  import(/* webpackChunkName: "dashboard-genai" */ './GenAIDashTitleButton').then((module) => ({
    default: module.GenAIDashTitleButton,
  }))
);
const GenAIPanelDescriptionButton = lazy(() =>
  import(/* webpackChunkName: "dashboard-genai" */ './GenAIPanelDescriptionButton').then((module) => ({
    default: module.GenAIPanelDescriptionButton,
  }))
);
const GenAIPanelTitleButton = lazy(() =>
  import(/* webpackChunkName: "dashboard-genai" */ './GenAIPanelTitleButton').then((module) => ({
    default: module.GenAIPanelTitleButton,
  }))
);

export function LazyGenAIDashDescriptionButton(props: GenAIDashDescriptionButtonProps) {
  return (
    <Suspense fallback={null}>
      <GenAIDashDescriptionButton {...props} />
    </Suspense>
  );
}

export function LazyGenAIDashTitleButton(props: GenAIDashTitleButtonProps) {
  return (
    <Suspense fallback={null}>
      <GenAIDashTitleButton {...props} />
    </Suspense>
  );
}

export function LazyGenAIPanelDescriptionButton(props: GenAIPanelDescriptionButtonProps) {
  return (
    <Suspense fallback={null}>
      <GenAIPanelDescriptionButton {...props} />
    </Suspense>
  );
}

export function LazyGenAIPanelTitleButton(props: GenAIPanelTitleButtonProps) {
  return (
    <Suspense fallback={null}>
      <GenAIPanelTitleButton {...props} />
    </Suspense>
  );
}
