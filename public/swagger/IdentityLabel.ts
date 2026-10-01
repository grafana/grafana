import { EditorView, WidgetType } from '@codemirror/view';

export class IdentityLabel extends WidgetType {
  constructor(private label: string) {
    super();
  }

  eq(other: IdentityLabel) {
    return this.label === other.label;
  }

  toDOM() {
    const dom = document.createElement('span');
    dom.className = 'cm-identity-label';
    dom.setAttribute('contenteditable', 'false');
    dom.textContent = this.label;
    return dom;
  }
}

export const identityAnnotationTheme = EditorView.baseTheme({
  '.cm-identity-label': {
    display: 'inline-block',
    marginLeft: '12px',
    padding: '0 6px',
    borderRadius: '3px',
    backgroundColor: 'rgba(127, 127, 127, 0.12)',
    fontFamily: 'sans-serif',
    fontSize: '0.9em',
  },
});
