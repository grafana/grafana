import { Suspense, lazy } from 'react';

import PageLoader from 'app/core/components/PageLoader/PageLoader';

import { type NotebookViewProps } from './NotebookView';

/**
 * The registered form of `grafana/notebook-view/v1`.
 *
 * Split out because the exposed-components registry is built during app init, so whatever it names
 * is reachable from the entry chunk. NotebookView pulls in the whole notebook scene — cells, the
 * code editor, drag and drop — which nobody who never opens a notebook should pay for. The
 * notebooks route splits on the same boundary via SafeDynamicImport.
 */
const NotebookView = lazy(() =>
  import(/* webpackChunkName: "NotebookView" */ './NotebookView').then((module) => ({
    default: module.NotebookView,
  }))
);

type SavedProps = Extract<NotebookViewProps, { uid: string }>;
type DraftProps = Extract<NotebookViewProps, { spec: unknown }>;

/**
 * Props are widened because the registry types every exposed component as `ComponentType<{}>` --
 * the contract is only checked on the consuming side, through `usePluginComponent`'s generic. A
 * host that names neither an existing notebook nor a document has nothing to show, so this renders
 * nothing rather than throwing out of someone else's React tree.
 */
export function NotebookViewLazy(props: Partial<SavedProps> & Partial<DraftProps>) {
  if (props.uid === undefined && props.spec === undefined) {
    return null;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by the guard above; the union cannot be expressed through the registry's `{}` prop type */}
      <NotebookView {...(props as NotebookViewProps)} />
    </Suspense>
  );
}
