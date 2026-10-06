import { EditorView, WidgetType } from '@codemirror/view';

const folderRequests = new WeakMap<HTMLElement, AbortController>();

export class FolderPicker extends WidgetType {
  constructor(
    private title: string,
    private uid: string,
    private namespace: string | undefined,
    private readOnly: boolean,
    private onSelect: ((text: string) => void) | undefined,
    private getValue: () => { from: number; to: number } | undefined
  ) {
    super();
  }

  eq(other: FolderPicker) {
    return (
      this.title === other.title &&
      this.uid === other.uid &&
      this.namespace === other.namespace &&
      this.readOnly === other.readOnly &&
      this.onSelect === other.onSelect &&
      this.getValue === other.getValue
    );
  }

  toDOM(view: EditorView) {
    const dom = document.createElement('select');
    dom.className = 'cm-folder-picker';
    dom.setAttribute('contenteditable', 'false');
    dom.setAttribute('aria-label', 'Folder');
    dom.title = 'select folder';
    // The picker is UI, so hovering it must not resolve the surrounding JSON schema description.
    dom.onmouseenter = () => view.dom.dispatchEvent(new MouseEvent('mouseleave'));
    dom.onmousemove = (event) => event.stopPropagation();
    dom.disabled = this.readOnly || !this.namespace;
    dom.add(new Option(this.title, this.uid, true, true));
    dom.onfocus = () => {
      void this.loadFolders(dom);
    };
    dom.onchange = () => {
      const value = this.getValue();
      if (!value || view.state.readOnly) {
        return;
      }
      const uid = dom.value;
      view.dispatch({ changes: { from: value.from, to: value.to, insert: JSON.stringify(uid) } });
      this.onSelect?.(view.state.doc.toString());
      view.focus();
    };
    return dom;
  }

  private async loadFolders(dom: HTMLSelectElement) {
    if (folderRequests.has(dom) || !this.namespace) {
      return;
    }
    // Retry starts from the selected option, discarding any partial or failed list.
    dom.options.length = 1;
    const controller = new AbortController();
    folderRequests.set(dom, controller);
    const loading = new Option('Loading folders…');
    loading.disabled = true;
    dom.add(loading);
    try {
      let next = '';
      do {
        const query = new URLSearchParams({ limit: '100' });
        if (next) {
          query.set('continue', next);
        }
        const response = await fetch(
          `apis/folder.grafana.app/v1/namespaces/${encodeURIComponent(this.namespace)}/folders?${query}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error('Folder list failed');
        }
        const data: {
          items: Array<{ metadata: { name: string }; spec: { title: string } }>;
          metadata?: { continue?: string };
        } = await response.json();
        if (controller.signal.aborted) {
          return;
        }
        for (const folder of data.items) {
          if (folder.metadata.name !== this.uid) {
            dom.add(new Option(`${folder.spec.title} (${folder.metadata.name})`, folder.metadata.name));
          }
        }
        next = data.metadata?.continue ?? '';
      } while (next);
      loading.remove();
    } catch {
      if (!controller.signal.aborted) {
        loading.textContent = 'Could not load folders. Focus again to retry.';
        folderRequests.delete(dom);
      }
    }
  }

  destroy(dom: HTMLElement) {
    folderRequests.get(dom)?.abort();
    folderRequests.delete(dom);
  }
}

export const folderAnnotationTheme = EditorView.baseTheme({
  '.cm-folder-picker': {
    display: 'inline-block',
    marginLeft: '12px',
    padding: '2px 6px',
    maxWidth: '320px',
    color: 'inherit',
    border: '1px solid currentColor',
    borderRadius: '3px',
    backgroundColor: 'rgba(127, 127, 127, 0.12)',
    fontFamily: 'sans-serif',
    fontSize: '0.9em',
    verticalAlign: 'baseline',
  },
});
