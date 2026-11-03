import { type QueryEditorInsertionSelectionV1, type QueryEditorInsertionTargetV1 } from './internalInsertionContract';
import { createQueryEditorInsertionRegistry } from './queryEditorInsertion';

function createTarget(selection: QueryEditorInsertionSelectionV1 | undefined) {
  return {
    getSelection: jest.fn(() => selection),
    replaceRange: jest.fn(),
  } satisfies QueryEditorInsertionTargetV1;
}

describe('createQueryEditorInsertionRegistry', () => {
  it('replaces the selection in the editor registered for the refId, with spacing applied', () => {
    const registry = createQueryEditorInsertionRegistry();
    const targetA = createTarget({ value: 'up', from: 2, to: 2 });
    const targetB = createTarget({ value: 'sum(rate(up[5m]))', from: 9, to: 11 });
    registry.registrarFor('A').register(targetA);
    registry.registrarFor('B').register(targetB);

    expect(registry.insert('B', 'http_requests_total', 'name')).toBe(true);
    expect(targetB.replaceRange).toHaveBeenCalledWith(9, 11, 'http_requests_total');
    expect(targetA.replaceRange).not.toHaveBeenCalled();

    expect(registry.insert('A', 'or', 'name')).toBe(true);
    expect(targetA.replaceRange).toHaveBeenCalledWith(2, 2, ' or');
  });

  it('quotes a label value inserted after a matcher', () => {
    const registry = createQueryEditorInsertionRegistry();
    const target = createTarget({ value: 'up{job=}', from: 7, to: 7 });
    registry.registrarFor('A').register(target);

    expect(registry.insert('A', 'api', 'value')).toBe(true);
    expect(target.replaceRange).toHaveBeenCalledWith(7, 7, '"api"');
  });

  it('leaves the query alone when the value cannot go at the cursor, rather than appending it', () => {
    const registry = createQueryEditorInsertionRegistry();
    const target = createTarget({ value: 'up{v=``}', from: 6, to: 6 });
    registry.registrarFor('A').register(target);

    expect(registry.insert('A', 'a`b', 'value')).toBe(true);
    expect(target.replaceRange).not.toHaveBeenCalled();
  });

  it('declines when no editor is registered for the refId', () => {
    const registry = createQueryEditorInsertionRegistry();
    registry.registrarFor('A').register(createTarget({ value: 'up', from: 0, to: 0 }));

    expect(registry.insert('B', 'up', 'name')).toBe(false);
  });

  it('declines when the editor has no selection to offer', () => {
    const registry = createQueryEditorInsertionRegistry();
    const target = createTarget(undefined);
    registry.registrarFor('A').register(target);

    expect(registry.insert('A', 'up', 'name')).toBe(false);
    expect(target.replaceRange).not.toHaveBeenCalled();
  });

  it('declines once the editor unregisters', () => {
    const registry = createQueryEditorInsertionRegistry();
    const unregister = registry.registrarFor('A').register(createTarget({ value: 'up', from: 0, to: 0 }));

    unregister();

    expect(registry.insert('A', 'up', 'name')).toBe(false);
  });

  it('keeps a remounted editor when the old one unregisters after it', () => {
    const registry = createQueryEditorInsertionRegistry();
    const registrar = registry.registrarFor('A');
    const unregisterOld = registrar.register(createTarget({ value: 'up', from: 0, to: 0 }));
    const next = createTarget({ value: 'up', from: 2, to: 2 });
    registrar.register(next);

    unregisterOld();

    expect(registry.insert('A', 'or', 'name')).toBe(true);
    expect(next.replaceRange).toHaveBeenCalledWith(2, 2, ' or');
  });

  it('hands out the same registrar for a refId every time', () => {
    const registry = createQueryEditorInsertionRegistry();

    expect(registry.registrarFor('A')).toBe(registry.registrarFor('A'));
    expect(registry.registrarFor('A')).not.toBe(registry.registrarFor('B'));
  });
});
