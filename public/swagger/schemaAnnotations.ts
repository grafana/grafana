import { syntaxTree } from '@codemirror/language';
import { type Range, StateEffect } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

import { FolderPicker, folderAnnotationTheme } from './FolderPicker';
import { IdentityLabel, identityAnnotationTheme } from './IdentityLabel';
import { type AnnotationName, annotationNames, annotationValues } from './annotationValue';

interface Resolution {
  status: 'unknown' | 'resolved' | 'missing';
  title: string;
}

interface Lookup {
  value?: string;
  resolution: Resolution;
  controller?: AbortController;
}

const lookupFinished = StateEffect.define<{ annotation: AnnotationName; resolution: Resolution }>();

export function schemaAnnotations(namespace?: string, onSelect?: (text: string) => void) {
  return [
    ViewPlugin.fromClass(
      class {
        decorations = Decoration.none;
        private values: ReturnType<typeof annotationValues>;
        private lookups = new Map<AnnotationName, Lookup>();
        private getFolderValue = () => this.values.get('grafana.app/folder');

        constructor(view: EditorView) {
          this.values = annotationValues(view.state);
          this.refreshLookups(view);
          this.decorate(view);
        }

        update(update: ViewUpdate) {
          const documentChanged = update.docChanged || syntaxTree(update.startState) !== syntaxTree(update.state);
          let changed = documentChanged || update.startState.readOnly !== update.state.readOnly;
          if (documentChanged) {
            this.values = annotationValues(update.state);
            this.refreshLookups(update.view);
          }
          for (const transaction of update.transactions) {
            for (const effect of transaction.effects) {
              if (effect.is(lookupFinished)) {
                const lookup = this.lookups.get(effect.value.annotation);
                if (lookup) {
                  lookup.resolution = effect.value.resolution;
                  changed = true;
                }
              }
            }
          }
          if (changed) {
            this.decorate(update.view);
          }
        }

        refreshLookups(view: EditorView) {
          for (const annotation of annotationNames) {
            const value = this.values.get(annotation)?.value;
            const previous = this.lookups.get(annotation);
            if (previous && previous.value === value) {
              continue;
            }
            previous?.controller?.abort();
            const isFolder = annotation === 'grafana.app/folder';
            const lookup: Lookup = {
              value,
              resolution: { status: 'unknown', title: isFolder ? 'Folder status unknown' : 'Identity unknown' },
            };
            this.lookups.set(annotation, lookup);
            if (value && (!isFolder || namespace)) {
              lookup.resolution.title = isFolder ? 'Loading folder…' : 'Loading identity…';
              lookup.controller = new AbortController();
              void this.lookup(view, annotation, value, lookup.controller.signal);
            }
          }
        }

        decorate(view: EditorView) {
          const ranges: Array<Range<Decoration>> = [];
          for (const [annotation, value] of this.values) {
            const resolution = this.lookups.get(annotation)!.resolution;
            const kind = annotation === 'grafana.app/folder' ? 'folder' : 'identity';
            ranges.push(
              Decoration.mark({ class: `cm-${kind}-annotation cm-annotation-${resolution.status}` }).range(
                value.from,
                value.to
              )
            );
            if (annotation === 'grafana.app/folder') {
              ranges.push(
                Decoration.widget({
                  widget: new FolderPicker(
                    resolution.title,
                    value.value ?? '',
                    namespace,
                    view.state.readOnly,
                    onSelect,
                    this.getFolderValue
                  ),
                  side: 1,
                }).range(value.widgetPos)
              );
            } else {
              ranges.push(
                Decoration.widget({ widget: new IdentityLabel(resolution.title), side: 1 }).range(value.widgetPos)
              );
            }
          }
          this.decorations = Decoration.set(ranges, true);
        }

        async lookup(view: EditorView, annotation: AnnotationName, value: string, signal: AbortSignal) {
          const isFolder = annotation === 'grafana.app/folder';
          let resolution: Resolution = {
            status: 'missing',
            title: isFolder ? 'Select folder' : 'Identity could not be resolved',
          };
          try {
            const url = isFolder
              ? `apis/folder.grafana.app/v1/namespaces/${encodeURIComponent(namespace!)}/folders/${encodeURIComponent(value)}`
              : `apis/iam.grafana.app/v0alpha1/namespaces/${encodeURIComponent(namespace ?? 'default')}/display?key=${encodeURIComponent(value)}`;
            const response = await fetch(url, { signal });
            if (response.ok) {
              let title: string | undefined;
              if (isFolder) {
                const data: { spec: { title: string } } = await response.json();
                title = data.spec.title;
              } else {
                const data: { display?: Array<{ displayName: string }>; invalidKeys?: string[] } =
                  await response.json();
                if (!data.invalidKeys?.includes(value)) {
                  title = data.display?.[0]?.displayName;
                }
              }
              if (title) {
                resolution = { status: 'resolved', title };
              }
            }
          } catch {
            // Preserve the saved value when the lookup fails.
          }
          if (!signal.aborted) {
            view.dispatch({ effects: lookupFinished.of({ annotation, resolution }) });
          }
        }

        destroy() {
          for (const lookup of this.lookups.values()) {
            lookup.controller?.abort();
          }
        }
      },
      { decorations: (plugin) => plugin.decorations }
    ),
    folderAnnotationTheme,
    identityAnnotationTheme,
    EditorView.baseTheme({
      '.cm-annotation-unknown, .cm-annotation-missing': {
        textDecoration: 'underline',
        textDecorationThickness: '2px',
        textUnderlineOffset: '3px',
      },
      '.cm-annotation-unknown': { textDecorationColor: 'gray' },
      '.cm-annotation-missing': { textDecorationColor: 'red' },
      '.cm-annotation-resolved': { textDecoration: 'none' },
    }),
  ];
}
