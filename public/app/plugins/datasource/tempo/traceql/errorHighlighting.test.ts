import { monacoTypes } from '@grafana/ui';

import { getWarningMarkers } from './errorHighlighting';

describe('ErrorHighlighting', () => {
  describe('gets correct warning markers for', () => {
    const message = 'Add resource or span scope to attribute to improve query performance.';

    describe('no warnings', () => {
      it('for span scope', () => {
        const { model } = setup('{ span.component = "http" }');
        const marker = getWarningMarkers(4, model);
        expect(marker).toEqual(expect.objectContaining([]));
      });
      it('for resource scope', () => {
        const { model } = setup('{ resource.component = "http" }');
        const marker = getWarningMarkers(4, model);
        expect(marker).toEqual(expect.objectContaining([]));
      });
      it('for parent scope', () => {
        const { model } = setup('{ parent.component = "http" }');
        const marker = getWarningMarkers(4, model);
        expect(marker).toEqual(expect.objectContaining([]));
      });
    });

    it('single warning', () => {
      const { model } = setup('{ .component = "http" }');
      const marker = getWarningMarkers(4, model);
      expect(marker).toEqual(
        expect.objectContaining([
          {
            message,
            severity: 4,
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 3,
            endColumn: 3,
          },
        ])
      );
    });

    it('multiple warnings', () => {
      const { model } = setup('{ .component = "http" || .http.status_code = 200 }');
      const marker = getWarningMarkers(4, model);
      expect(marker).toEqual(
        expect.objectContaining([
          {
            message,
            severity: 4,
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 3,
            endColumn: 3,
          },
          {
            message,
            severity: 4,
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 26,
            endColumn: 26,
          },
        ])
      );
    });

    it('multiple parts, single warning', () => {
      const { model } = setup('{ resource.component = "http" || .http.status_code = 200 }');
      const marker = getWarningMarkers(4, model);
      expect(marker).toEqual(
        expect.objectContaining([
          {
            message,
            severity: 4,
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 34,
            endColumn: 34,
          },
        ])
      );
    });
  });
});

function setup(value: string) {
  const model = makeModel(value);
  return { model } as unknown as { model: monacoTypes.editor.ITextModel };
}

function makeModel(value: string) {
  return {
    id: 'test_monaco',
    getValue() {
      return value;
    },
    getLineLength() {
      return value.length;
    },
  };
}
