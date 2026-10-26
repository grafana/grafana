import { type ExprTextKind, insertAtSelection } from '../utils/prometheus';

import {
  type QueryEditorInsertionRegistrationV1,
  type QueryEditorInsertionTargetV1,
} from './internalInsertionContract';

export interface QueryEditorInsertionRegistry {
  /** The same registrar for a refId every time, so the editor does not re-register on each render. */
  registrarFor(refId: string): QueryEditorInsertionRegistrationV1;
  /** Inserts at the selection the user left in the query's editor; `false` when there is none to use. */
  insert(refId: string, text: string, kind: ExprTextKind): boolean;
}

export function createQueryEditorInsertionRegistry(): QueryEditorInsertionRegistry {
  const targets = new Map<string, QueryEditorInsertionTargetV1>();
  const registrars = new Map<string, QueryEditorInsertionRegistrationV1>();

  return {
    registrarFor(refId) {
      let registrar = registrars.get(refId);
      if (!registrar) {
        registrar = {
          register(target) {
            targets.set(refId, target);
            return () => {
              // A remounted editor can register before the old one unregisters.
              if (targets.get(refId) === target) {
                targets.delete(refId);
              }
            };
          },
        };
        registrars.set(refId, registrar);
      }
      return registrar;
    },

    insert(refId, text, kind) {
      const target = targets.get(refId);
      const selection = target?.getSelection();
      if (!target || !selection) {
        return false;
      }
      const { from, to } = selection;
      const inserted = insertAtSelection(selection.value, from, to, text, kind);
      // The user chose this spot, so text that cannot go there is dropped rather than appended elsewhere.
      if (inserted) {
        target.replaceRange(from, to, inserted.text);
      }
      return true;
    },
  };
}
