import { Plugin } from '@grafana/slate-react';
import { Editor as CoreEditor } from 'slate';

/**
 * @alpha
 */
// This plugin should be used to prevent inserting new lines when pressing shift+enter inside a query editor
export function PreventNewLineOnShiftEnterPlugin({ handler }: any): Plugin {
  return {
    onKeyDown(event: Event, editor: CoreEditor, next: Function) {
      const keyEvent = event as KeyboardEvent;

      // Handle enter
      if (handler && keyEvent.key === 'Enter' && keyEvent.shiftKey) {
        // Submit on Enter
        keyEvent.preventDefault();
        return editor;
      }

      return next();
    },
  };
}
